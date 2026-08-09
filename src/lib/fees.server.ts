import { admin, logAudit } from "./db.server";
import { getBruhConfig } from "./bruh-config.server";
import { isValidSolanaAddress, verifyTransferByReference } from "./solana.server";

export type FeeLeg = "buy" | "sell";

export type FeeSplit = {
  /** What the user asked to move, in base units. */
  grossBaseUnits: bigint;
  /** What the treasury receives. */
  feeBaseUnits: bigint;
  /** What actually goes through the swap. gross - fee, never negative. */
  netBaseUnits: bigint;
  feeBps: number;
};

/**
 * Pure integer split. Fee is floored so rounding can never hand the treasury
 * more than the stated rate, and net + fee always equals gross exactly.
 */
export function splitFee(grossBaseUnits: bigint, feeBps: number): FeeSplit {
  if (grossBaseUnits <= 0n || feeBps <= 0) {
    return {
      grossBaseUnits: grossBaseUnits > 0n ? grossBaseUnits : 0n,
      feeBaseUnits: 0n,
      netBaseUnits: grossBaseUnits > 0n ? grossBaseUnits : 0n,
      feeBps: feeBps > 0 ? feeBps : 0,
    };
  }
  const bps = BigInt(Math.floor(feeBps));
  const fee = (grossBaseUnits * bps) / 10_000n;
  return {
    grossBaseUnits,
    feeBaseUnits: fee,
    netBaseUnits: grossBaseUnits - fee,
    feeBps: Math.floor(feeBps),
  };
}

export type FeeQuote =
  | { enabled: false; reason: "no_treasury" | "fee_disabled"; split: FeeSplit }
  | { enabled: true; treasuryAddress: string; split: FeeSplit };

/**
 * The single place that decides whether a fee applies. With no treasury
 * configured the fee is off and the user pays nothing — it never silently
 * defaults to some other address.
 */
export function quoteFee(grossBaseUnits: bigint): FeeQuote {
  const { feeBps, feeTreasuryAddress, feeEnabled } = getBruhConfig();

  if (!feeEnabled || !isValidSolanaAddress(feeTreasuryAddress)) {
    return {
      enabled: false,
      reason: feeTreasuryAddress.length === 0 ? "no_treasury" : "fee_disabled",
      split: splitFee(grossBaseUnits, 0),
    };
  }

  const split = splitFee(grossBaseUnits, feeBps);
  if (split.feeBaseUnits === 0n) {
    return { enabled: false, reason: "fee_disabled", split };
  }
  return { enabled: true, treasuryAddress: feeTreasuryAddress, split };
}

export type RecordedFee = { id: string; feeBaseUnits: bigint } | null;

/**
 * Records the fee leg as pending. Nothing is treated as collected until the
 * chain confirms it in `confirmFeeEvent`.
 */
export async function recordFeeEvent(input: {
  leg: FeeLeg;
  groupId?: string | null;
  membershipId?: string | null;
  tipIntentId?: string | null;
  assetSymbol: string;
  assetMint: string | null;
  grossBaseUnits: bigint;
  usdReference?: number | null;
}): Promise<RecordedFee> {
  const quote = quoteFee(input.grossBaseUnits);
  if (!quote.enabled) return null;

  const db = await admin();
  const { data, error } = await db
    .from("fee_events")
    .insert({
      leg: input.leg,
      group_id: input.groupId ?? null,
      membership_id: input.membershipId ?? null,
      tip_intent_id: input.tipIntentId ?? null,
      asset_symbol: input.assetSymbol,
      asset_mint: input.assetMint,
      gross_base_units: quote.split.grossBaseUnits.toString(),
      fee_base_units: quote.split.feeBaseUnits.toString(),
      fee_bps: quote.split.feeBps,
      treasury_address: quote.treasuryAddress,
      usd_reference_at_execution: input.usdReference ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id as string, feeBaseUnits: quote.split.feeBaseUnits };
}

/**
 * Confirms a pending fee against the chain using the same reference-key proof
 * used for tips. A fee is only ever marked collected when the treasury was
 * actually credited the expected amount.
 */
export async function confirmFeeEvent(input: {
  feeEventId: string;
  reference: string;
}): Promise<{ status: "confirmed" | "pending" | "not_found"; signature?: string }> {
  const db = await admin();
  const { data: event } = await db
    .from("fee_events")
    .select("*")
    .eq("id", input.feeEventId)
    .maybeSingle();
  if (!event) return { status: "not_found" };
  if (event.status === "confirmed") {
    return { status: "confirmed", signature: event.signature ?? "" };
  }

  const verification = await verifyTransferByReference({
    reference: input.reference,
    recipient: event.treasury_address,
    mint: event.asset_mint,
    amountBaseUnits: BigInt(event.fee_base_units),
  });
  if (!verification.verified) return { status: "pending" };

  await db
    .from("fee_events")
    .update({ status: "confirmed", signature: verification.signature })
    .eq("id", input.feeEventId);

  await logAudit({
    groupId: event.group_id,
    actorType: "system",
    eventType: "service_fee_confirmed",
    entityType: "fee_event",
    entityId: input.feeEventId,
    after: { signature: verification.signature, leg: event.leg },
  });

  return { status: "confirmed", signature: verification.signature! };
}

export type FeeTotals = {
  confirmedCount: number;
  pendingCount: number;
  byAsset: { assetSymbol: string; confirmedBaseUnits: string; usdReference: number }[];
  usdConfirmed: number;
};

/** Treasury reporting: what has actually been collected, never estimated. */
export async function feeTotals(groupId?: string | null): Promise<FeeTotals> {
  const db = await admin();
  let query = db.from("fee_events").select("asset_symbol, fee_base_units, usd_reference_at_execution, status");
  if (groupId) query = query.eq("group_id", groupId);
  const { data } = await query;

  const rows = (data ?? []) as any[];
  const byAsset = new Map<string, { base: bigint; usd: number }>();
  let confirmedCount = 0;
  let pendingCount = 0;
  let usdConfirmed = 0;

  for (const row of rows) {
    if (row.status !== "confirmed") {
      if (row.status === "pending") pendingCount += 1;
      continue;
    }
    confirmedCount += 1;
    const usd = Number(row.usd_reference_at_execution ?? 0);
    usdConfirmed += Number.isFinite(usd) ? usd : 0;
    const entry = byAsset.get(row.asset_symbol) ?? { base: 0n, usd: 0 };
    entry.base += BigInt(row.fee_base_units);
    entry.usd += Number.isFinite(usd) ? usd : 0;
    byAsset.set(row.asset_symbol, entry);
  }

  return {
    confirmedCount,
    pendingCount,
    usdConfirmed,
    byAsset: [...byAsset.entries()].map(([assetSymbol, entry]) => ({
      assetSymbol,
      confirmedBaseUnits: entry.base.toString(),
      usdReference: entry.usd,
    })),
  };
}
