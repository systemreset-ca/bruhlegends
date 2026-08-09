import { admin, activeSeason, logAudit } from "./db.server";
import { fetchCheckedSnapshot, fetchTokenSnapshot } from "./market.server";
import { MILESTONES } from "./bruh-config.server";

/** Milestones a given multiple has reached, ascending. Pure. */
export function milestonesFor(multiple: number): number[] {
  if (!Number.isFinite(multiple) || multiple <= 0) return [];
  return MILESTONES.filter((milestone) => multiple >= milestone);
}


const BASE58_TOKEN = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

export function extractCandidateMints(text: string): string[] {
  return Array.from(new Set(text.match(BASE58_TOKEN) ?? []));
}

export type CallCreation =
  | { ok: true; callId: string; snapshot: NonNullable<Awaited<ReturnType<typeof fetchTokenSnapshot>>> }
  | { ok: false; reason: string; detail?: string };

/**
 * Creates a call with an immutable baseline snapshot. First valid human call in
 * a group and season wins; later posts are told who called it first.
 */
export async function createCall(input: {
  groupId: string;
  callerMembershipId: string;
  mint: string;
  note?: string | null;
  sourceMessageId?: number | null;
  source?: string;
  minLiquidityUsd: number;
  allowRepeatCalls: boolean;
}): Promise<CallCreation> {
  const db = await admin();
  const season = await activeSeason(input.groupId);

  const { data: existing } = await db
    .from("calls")
    .select("id, caller_membership_id, baseline_market_cap_usd, ath_multiple")
    .eq("group_id", input.groupId)
    .eq("mint", input.mint)
    .in("status", ["active", "pending_confirmation", "quarantined"])
    .maybeSingle();

  if (existing && !input.allowRepeatCalls) {
    return { ok: false, reason: "already_called", detail: existing.id };
  }

  const checked = await fetchCheckedSnapshot(input.mint);
  if (!checked) return { ok: false, reason: "token_unresolved" };
  // A baseline is immutable, so it must come from agreeing sources with real depth.
  if (checked.crossCheck === "disagree") return { ok: false, reason: "provider_disagreement" };
  const snapshot = checked.snapshot;
  if (snapshot.priceUsd === null) return { ok: false, reason: "no_price_source" };
  if (snapshot.liquidityUsd === null) return { ok: false, reason: "no_liquidity_data" };
  if (snapshot.liquidityUsd < input.minLiquidityUsd) {
    return { ok: false, reason: "insufficient_liquidity" };
  }


  const { data, error } = await db
    .from("calls")
    .insert({
      group_id: input.groupId,
      season_id: season?.id ?? null,
      caller_membership_id: input.callerMembershipId,
      mint: input.mint,
      symbol: snapshot.symbol,
      name: snapshot.name,
      pool_address: snapshot.poolAddress,
      status: "active",
      source: input.source ?? "explicit",
      source_message_id: input.sourceMessageId ?? null,
      note: input.note ?? null,
      baseline_price_usd: snapshot.priceUsd,
      baseline_market_cap_usd: snapshot.marketCapUsd,
      baseline_liquidity_usd: snapshot.liquidityUsd,
      baseline_provider: snapshot.provider,
      baseline_raw: snapshot.raw as never,
      ath_price_usd: snapshot.priceUsd,
      ath_multiple: 1,
      last_price_usd: snapshot.priceUsd,
      last_observed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, reason: "already_called" };
    throw error;
  }

  await logAudit({
    groupId: input.groupId,
    actorType: "member",
    actorId: input.callerMembershipId,
    eventType: "call_created",
    entityType: "call",
    entityId: data.id,
    after: { mint: input.mint, baseline: snapshot.priceUsd },
  });

  return { ok: true, callId: data.id, snapshot };
}

export type MilestoneHit = { callId: string; milestone: number; multiple: number };

/**
 * Refreshes open calls and records milestones exactly once each. Observations
 * that fail the liquidity floor are quarantined instead of scoring.
 */
export async function refreshCalls(limit = 40): Promise<{
  refreshed: number;
  quarantined: number;
  milestones: MilestoneHit[];
}> {
  const db = await admin();
  const { data: calls } = await db
    .from("calls")
    .select("id, mint, group_id, baseline_price_usd, ath_price_usd, ath_multiple, status")
    .in("status", ["active", "quarantined"])
    .order("last_observed_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  const hits: MilestoneHit[] = [];
  let refreshed = 0;
  let quarantined = 0;

  for (const call of calls ?? []) {
    const snapshot = await fetchTokenSnapshot(call.mint);
    const observedAt = new Date().toISOString();

    if (!snapshot || snapshot.priceUsd === null) {
      await db.from("market_observations").insert({
        call_id: call.id,
        observed_at: observedAt,
        provider: "dexscreener",
        quarantined: true,
        quarantine_reason: "provider_unavailable",
      });
      quarantined += 1;
      continue;
    }

    const { data: group } = await db
      .from("groups")
      .select("min_liquidity_usd")
      .eq("id", call.group_id)
      .maybeSingle();
    const floor = Number(group?.min_liquidity_usd ?? 0);
    const suspicious = (snapshot.liquidityUsd ?? 0) < floor;

    await db.from("market_observations").insert({
      call_id: call.id,
      observed_at: observedAt,
      price_usd: snapshot.priceUsd,
      market_cap_usd: snapshot.marketCapUsd,
      liquidity_usd: snapshot.liquidityUsd,
      provider: snapshot.provider,
      quarantined: suspicious,
      quarantine_reason: suspicious ? "liquidity_below_group_floor" : null,
      raw: snapshot.raw as never,
    });

    refreshed += 1;

    if (suspicious) {
      quarantined += 1;
      await db.from("calls").update({
        status: "quarantined",
        last_price_usd: snapshot.priceUsd,
        last_observed_at: observedAt,
      }).eq("id", call.id);
      continue;
    }

    const baseline = Number(call.baseline_price_usd ?? 0);
    const multiple = baseline > 0 ? snapshot.priceUsd / baseline : 0;
    const isNewAth = snapshot.priceUsd > Number(call.ath_price_usd ?? 0);

    await db
      .from("calls")
      .update({
        status: "active",
        last_price_usd: snapshot.priceUsd,
        last_observed_at: observedAt,
        ...(isNewAth
          ? { ath_price_usd: snapshot.priceUsd, ath_multiple: multiple, ath_at: observedAt }
          : {}),
      })
      .eq("id", call.id);

    for (const milestone of MILESTONES) {
      if (multiple < milestone) continue;
      const { error } = await db.from("milestones").insert({
        call_id: call.id,
        milestone,
        price_usd: snapshot.priceUsd,
        reached_at: observedAt,
      });
      if (!error) hits.push({ callId: call.id, milestone, multiple });
    }
  }

  return { refreshed, quarantined, milestones: hits };
}
