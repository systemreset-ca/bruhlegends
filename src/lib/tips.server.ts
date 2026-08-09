import { admin, logAudit } from "./db.server";
import { getActiveWallet } from "./wallets.server";
import {
  buildSolanaPayUrl,
  createReferenceKey,
  verifyTransferByReference,
} from "./solana.server";
import { fetchUsdPrice } from "./market.server";
import { getBruhConfig, USDC_MAINNET_MINT } from "./bruh-config.server";

export type TipAsset = { symbol: string; mint: string | null; decimals: number };

const SOL: TipAsset = { symbol: "SOL", mint: null, decimals: 9 };
const USDC: TipAsset = { symbol: "USDC", mint: USDC_MAINNET_MINT, decimals: 6 };

export function resolveAsset(symbol: string): TipAsset | null {
  const upper = symbol.toUpperCase();
  if (upper === "SOL") return SOL;
  if (upper === "USDC") return USDC;
  if (upper === "BRUH") {
    const { bruhMint, bruhTippingEnabled } = getBruhConfig();
    if (!bruhTippingEnabled) return null;
    return { symbol: "BRUH", mint: bruhMint, decimals: 9 };
  }
  return null;
}

export function toBaseUnits(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * 10 ** decimals));
}

export type TipIntent = {
  id: string;
  reference: string;
  payUrl: string;
  recipientAddress: string;
  amountDisplay: number;
  assetSymbol: string;
  expiresAt: string;
};

/**
 * Builds an unsigned payment request. Nothing is credited here — the tip only
 * becomes real once the chain confirms it in `confirmTip`.
 */
export async function createTipIntent(input: {
  groupId: string;
  senderMembershipId: string;
  recipientMembershipId: string;
  assetSymbol: string;
  amount: number;
  callId?: string | null;
  privacy?: "public" | "pseudonymous" | "anonymous" | "private";
}): Promise<{ ok: true; intent: TipIntent } | { ok: false; reason: string }> {
  if (!(input.amount > 0)) return { ok: false, reason: "invalid_amount" };
  if (input.senderMembershipId === input.recipientMembershipId) {
    return { ok: false, reason: "self_tip" };
  }

  const asset = resolveAsset(input.assetSymbol);
  if (!asset) return { ok: false, reason: "asset_unavailable" };

  const recipientAddress = await getActiveWallet(input.recipientMembershipId);
  if (!recipientAddress) return { ok: false, reason: "recipient_wallet_missing" };

  const db = await admin();
  const { tipIntentTtlMinutes } = getBruhConfig();
  const reference = createReferenceKey();
  const expiresAt = new Date(Date.now() + tipIntentTtlMinutes * 60_000).toISOString();
  const usdPrice = asset.mint
    ? await fetchUsdPrice(asset.mint)
    : await fetchUsdPrice("So11111111111111111111111111111111111111112");

  const { data, error } = await db
    .from("tip_intents")
    .insert({
      group_id: input.groupId,
      call_id: input.callId ?? null,
      sender_membership_id: input.senderMembershipId,
      recipient_membership_id: input.recipientMembershipId,
      recipient_address: recipientAddress,
      asset_symbol: asset.symbol,
      asset_mint: asset.mint,
      amount_base_units: toBaseUnits(input.amount, asset.decimals).toString(),
      amount_display: input.amount,
      usd_reference: usdPrice ? usdPrice * input.amount : null,
      reference_key: reference,
      privacy: input.privacy ?? "public",
      status: "created",
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw error;

  return {
    ok: true,
    intent: {
      id: data.id,
      reference,
      payUrl: buildSolanaPayUrl({
        recipient: recipientAddress,
        amountDisplay: input.amount,
        reference,
        splToken: asset.mint,
        message: "BRUH tip",
      }),
      recipientAddress,
      amountDisplay: input.amount,
      assetSymbol: asset.symbol,
      expiresAt,
    },
  };
}

export type TipConfirmation =
  | { status: "confirmed"; signature: string }
  | { status: "pending" | "expired" | "not_found"; reason?: string };

/** Idempotent: re-checking a confirmed tip returns the stored signature. */
export async function confirmTip(intentId: string): Promise<TipConfirmation> {
  const db = await admin();
  const { data: intent } = await db
    .from("tip_intents")
    .select("*")
    .eq("id", intentId)
    .maybeSingle();
  if (!intent) return { status: "not_found" };

  if (intent.status === "confirmed") {
    const { data: transfer } = await db
      .from("verified_transfers")
      .select("signature")
      .eq("tip_intent_id", intentId)
      .maybeSingle();
    return { status: "confirmed", signature: transfer?.signature ?? "" };
  }

  const verification = await verifyTransferByReference({
    reference: intent.reference_key,
    recipient: intent.recipient_address,
    mint: intent.asset_mint,
    amountBaseUnits: BigInt(intent.amount_base_units),
  });

  if (!verification.verified) {
    if (new Date(intent.expires_at) < new Date()) {
      await db.from("tip_intents").update({ status: "expired" }).eq("id", intentId);
      return { status: "expired", reason: verification.reason };
    }
    await db.from("tip_intents").update({ status: "awaiting_payment" }).eq("id", intentId);
    return { status: "pending", reason: verification.reason };
  }

  await db.from("verified_transfers").insert({
    tip_intent_id: intentId,
    signature: verification.signature,
    slot: verification.slot ?? null,
    recipient_address: intent.recipient_address,
    asset_mint: intent.asset_mint,
    amount_base_units: intent.amount_base_units,
    usd_reference_at_execution: intent.usd_reference,
    confirmed_at: new Date().toISOString(),
    raw: verification.raw as never,
  });
  await db.from("tip_intents").update({ status: "confirmed" }).eq("id", intentId);

  await logAudit({
    groupId: intent.group_id,
    actorType: "member",
    actorId: intent.sender_membership_id,
    eventType: "tip_confirmed",
    entityType: "tip_intent",
    entityId: intentId,
    after: { signature: verification.signature },
  });

  return { status: "confirmed", signature: verification.signature! };
}
