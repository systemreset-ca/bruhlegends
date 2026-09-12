import { admin, logAudit } from "./db.server";
import { getActiveWallet } from "./wallets.server";
import {
  buildSolanaPayUrl,
  createReferenceKey,
  verifyTransferByReference,
} from "./solana.server";
import { fetchUsdPrice } from "./market.server";
import {
  getBruhConfig,
  USDC_MAINNET_MINT,
  type BruhConfig,
} from "./bruh-config.server";

export type TipAsset = { symbol: string; mint: string | null; decimals: number };

export type TipMembership = {
  id: string;
  group_id: string;
  is_banned: boolean;
};

export function tipMembershipScopeError(
  input: { groupId: string; senderMembershipId: string; recipientMembershipId: string },
  memberships: TipMembership[],
): "membership_group_mismatch" | "membership_unavailable" | null {
  const sender = memberships.find((membership) => membership.id === input.senderMembershipId);
  const recipient = memberships.find((membership) => membership.id === input.recipientMembershipId);

  if (!sender || !recipient || sender.group_id !== input.groupId || recipient.group_id !== input.groupId) {
    return "membership_group_mismatch";
  }
  if (sender.is_banned || recipient.is_banned) return "membership_unavailable";
  return null;
}

export function isTipIntentExpired(expiresAt: string, nowMs: number = Date.now()): boolean {
  const expiresAtMs = Date.parse(expiresAt);
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs;
}

const FALLBACK_ASSETS: Record<string, TipAsset> = {
  SOL: { symbol: "SOL", mint: null, decimals: 9 },
};

export type RegisteredTipAsset = TipAsset & {
  enabled: boolean;
  is_tip_asset: boolean;
  network: "mainnet-beta" | "devnet";
};

export function isAllowedRegisteredTipAsset(
  asset: RegisteredTipAsset,
  config: Pick<BruhConfig, "network" | "bruhMint" | "bruhTippingEnabled">,
): boolean {
  if (!asset.enabled || !asset.is_tip_asset || asset.network !== config.network) return false;

  if (asset.symbol === "SOL") return asset.mint === null;
  if (asset.symbol === "USDC") {
    return config.network === "mainnet-beta"
      ? asset.mint === USDC_MAINNET_MINT
      : typeof asset.mint === "string" && asset.mint.length > 0;
  }
  if (asset.symbol === "BRUH") {
    return (
      config.bruhTippingEnabled &&
      config.bruhMint.length > 0 &&
      asset.mint === config.bruhMint
    );
  }
  return false;
}

/**
 * Asset availability is driven by the `supported_assets` registry, so enabling
 * BRUH is a data change plus the mint env var — never a code change.
 */
export async function resolveAsset(symbol: string): Promise<TipAsset | null> {
  const upper = symbol.toUpperCase();
  const config = getBruhConfig();
  const { network } = config;
  const db = await admin();
  const { data } = await db
    .from("supported_assets")
    .select("symbol, mint, decimals, enabled, is_tip_asset, network")
    .eq("symbol", upper)
    .eq("network", network)
    .maybeSingle();

  if (data) {
    const registered = {
      symbol: data.symbol as string,
      mint: (data.mint as string | null) ?? null,
      decimals: Number(data.decimals),
      enabled: Boolean(data.enabled),
      is_tip_asset: Boolean(data.is_tip_asset),
      network: data.network as "mainnet-beta" | "devnet",
    } satisfies RegisteredTipAsset;
    if (!isAllowedRegisteredTipAsset(registered, config)) return null;
    return {
      symbol: registered.symbol,
      mint: registered.mint,
      decimals: registered.decimals,
    };
  }

  if (upper === "USDC" && network === "mainnet-beta") {
    return { symbol: "USDC", mint: USDC_MAINNET_MINT, decimals: 6 };
  }
  return FALLBACK_ASSETS[upper] ?? null;
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

  const db = await admin();
  const { data: membershipRows, error: membershipError } = await db
    .from("group_members")
    .select("id, group_id, is_banned")
    .in("id", [input.senderMembershipId, input.recipientMembershipId]);
  if (membershipError) throw membershipError;

  const scopeError = tipMembershipScopeError(input, (membershipRows ?? []) as TipMembership[]);
  if (scopeError) return { ok: false, reason: scopeError };

  const asset = await resolveAsset(input.assetSymbol);
  if (!asset) return { ok: false, reason: "asset_unavailable" };

  const recipientAddress = await getActiveWallet(input.recipientMembershipId);
  if (!recipientAddress) return { ok: false, reason: "recipient_wallet_missing" };

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
  | { status: "pending" | "expired" | "not_found"; reason?: string | undefined };

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

  if (intent.status === "expired") return { status: "expired", reason: "intent_expired" };

  if (isTipIntentExpired(intent.expires_at)) {
    await db.from("tip_intents").update({ status: "expired" }).eq("id", intentId);
    await logAudit({
      groupId: intent.group_id,
      actorType: "system",
      eventType: "tip_expired",
      entityType: "tip_intent",
      entityId: intentId,
      before: { status: intent.status },
      after: { status: "expired" },
    });
    return { status: "expired", reason: "intent_expired" };
  }

  const verification = await verifyTransferByReference({
    reference: intent.reference_key,
    recipient: intent.recipient_address,
    mint: intent.asset_mint,
    amountBaseUnits: BigInt(intent.amount_base_units),
  });

  if (!verification.verified) {
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

export type TipSweepResult = {
  checked: number;
  confirmed: { intentId: string; signature: string }[];
  expired: number;
};

/**
 * Scheduled sweep: verifies outstanding tips on-chain and expires stale ones.
 * Nothing is credited without a confirmed transfer.
 */
export async function sweepTipIntents(limit = 40): Promise<TipSweepResult> {
  const db = await admin();
  const { data: intents } = await db
    .from("tip_intents")
    .select("id, expires_at, status")
    .in("status", ["created", "awaiting_payment"])
    .order("created_at", { ascending: true })
    .limit(limit);

  const confirmed: { intentId: string; signature: string }[] = [];
  let expired = 0;

  for (const intent of intents ?? []) {
    const result = await confirmTip(intent.id);
    if (result.status === "confirmed") {
      confirmed.push({ intentId: intent.id, signature: result.signature });
    } else if (result.status === "expired") {
      expired += 1;
    }
  }

  return { checked: intents?.length ?? 0, confirmed, expired };
}

export type PendingTip = {
  id: string;
  direction: "sent" | "received";
  assetSymbol: string;
  amountDisplay: number;
  recipientAddress: string;
  reference: string;
  payUrl: string;
  status: string;
  expiresAt: string;
  counterparty: string;
};

/** Outstanding tips for one membership, with a fresh Solana Pay link each time. */
export async function listPendingTips(membershipId: string): Promise<PendingTip[]> {
  const db = await admin();
  const { data } = await db
    .from("tip_intents")
    .select(
      "id, asset_symbol, asset_mint, amount_display, recipient_address, reference_key, status, expires_at, sender_membership_id, recipient_membership_id",
    )
    .or(`sender_membership_id.eq.${membershipId},recipient_membership_id.eq.${membershipId}`)
    .in("status", ["created", "awaiting_payment"])
    .order("created_at", { ascending: false })
    .limit(10);

  const rows = (data ?? []) as any[];
  const otherIds = Array.from(
    new Set(
      rows.map((row) =>
        row.sender_membership_id === membershipId
          ? row.recipient_membership_id
          : row.sender_membership_id,
      ),
    ),
  );
  const { data: members } = otherIds.length
    ? await db.from("group_members").select("id, display_name").in("id", otherIds)
    : { data: [] as any[] };
  const names = new Map<string, string>(
    (members ?? []).map((m: any) => [m.id as string, (m.display_name ?? "member") as string]),
  );

  return rows.map((row) => {
    const direction = row.sender_membership_id === membershipId ? "sent" : "received";
    const otherId =
      direction === "sent" ? row.recipient_membership_id : row.sender_membership_id;
    return {
      id: row.id as string,
      direction: direction as "sent" | "received",
      assetSymbol: row.asset_symbol as string,
      amountDisplay: Number(row.amount_display),
      recipientAddress: row.recipient_address as string,
      reference: row.reference_key as string,
      payUrl: buildSolanaPayUrl({
        recipient: row.recipient_address,
        amountDisplay: Number(row.amount_display),
        reference: row.reference_key,
        splToken: row.asset_mint,
        message: "BRUH tip",
      }),
      status: row.status as string,
      expiresAt: row.expires_at as string,
      counterparty: names.get(otherId) ?? "member",
    };
  });
}
