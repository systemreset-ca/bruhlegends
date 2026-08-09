import { admin, logAudit } from "./db.server";

/** Season management is admin-only; calls attach to whichever season is active. */
export async function startSeason(groupId: string, name: string) {
  const db = await admin();
  await db
    .from("seasons")
    .update({ is_active: false, ends_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("is_active", true);
  const { data, error } = await db
    .from("seasons")
    .insert({ group_id: groupId, name, is_active: true })
    .select("id, name, starts_at")
    .single();
  if (error) throw error;
  await logAudit({
    groupId,
    actorType: "admin",
    eventType: "season_started",
    entityType: "season",
    entityId: data.id,
    after: { name },
  });
  return data;
}

export async function endSeason(groupId: string) {
  const db = await admin();
  const { data } = await db
    .from("seasons")
    .select("id, name")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  await db
    .from("seasons")
    .update({ is_active: false, ends_at: new Date().toISOString() })
    .eq("id", data.id);
  await logAudit({
    groupId,
    actorType: "admin",
    eventType: "season_ended",
    entityType: "season",
    entityId: data.id,
  });
  return data;
}

export async function listSeasons(groupId: string) {
  const db = await admin();
  const { data } = await db
    .from("seasons")
    .select("id, name, starts_at, ends_at, is_active")
    .eq("group_id", groupId)
    .order("starts_at", { ascending: false })
    .limit(12);
  return (data ?? []) as {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string | null;
    is_active: boolean;
  }[];
}

export async function listOpenDisputes(groupId: string) {
  const db = await admin();
  const { data } = await db
    .from("disputes")
    .select("id, reason, status, created_at, call_id, calls(symbol, mint), group_members!disputes_raised_by_membership_id_fkey(display_name)")
    .eq("group_id", groupId)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(20);
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    reason: row.reason as string,
    createdAt: row.created_at as string,
    callId: (row.call_id ?? null) as string | null,
    token: (row.calls?.symbol ?? row.calls?.mint?.slice(0, 6) ?? null) as string | null,
    raisedBy: (row.group_members?.display_name ?? "member") as string,
  }));
}

export type DisputeResolution = "uphold" | "reject";

/**
 * Upholding a dispute invalidates the call, which removes it from scoring on
 * the next leaderboard read — scores are always derived, never stored.
 */
export async function resolveDispute(input: {
  groupId: string;
  disputeId: string;
  moderatorMembershipId: string;
  outcome: DisputeResolution;
  note?: string | null;
}) {
  const db = await admin();
  const { data: dispute } = await db
    .from("disputes")
    .select("id, call_id, status")
    .eq("id", input.disputeId)
    .eq("group_id", input.groupId)
    .maybeSingle();
  if (!dispute) return { ok: false as const, reason: "not_found" };
  if (dispute.status !== "open") return { ok: false as const, reason: "already_resolved" };

  await db
    .from("disputes")
    .update({
      status: input.outcome === "uphold" ? "upheld" : "rejected",
      resolution: input.note ?? null,
      resolved_by_membership_id: input.moderatorMembershipId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", dispute.id);

  if (input.outcome === "uphold" && dispute.call_id) {
    await db
      .from("calls")
      .update({ status: "invalidated", invalidated_reason: input.note ?? "dispute_upheld" })
      .eq("id", dispute.call_id);
  }

  await logAudit({
    groupId: input.groupId,
    actorType: "moderator",
    actorId: input.moderatorMembershipId,
    eventType: "dispute_resolved",
    entityType: "dispute",
    entityId: dispute.id,
    after: { outcome: input.outcome, callId: dispute.call_id },
  });

  return { ok: true as const, callId: (dispute.call_id ?? null) as string | null };
}

export type GroupSettingsPatch = {
  detection_mode?: "command_only" | "full_detection" | undefined;
  min_liquidity_usd?: number | undefined;
  min_token_age_minutes?: number | undefined;
  allow_repeat_calls?: boolean | undefined;
  announce_tips?: boolean | undefined;
  announcement_mode?: "immediate" | "off" | undefined;
  quiet_hours_start?: number | null | undefined;
  quiet_hours_end?: number | null | undefined;
  raw_message_retention_days?: number | undefined;
};

export async function updateGroupSettings(
  groupId: string,
  actorMembershipId: string,
  patch: GroupSettingsPatch,
) {
  const db = await admin();
  const { data: before } = await db.from("groups").select("*").eq("id", groupId).maybeSingle();
  const { data, error } = await db
    .from("groups")
    .update(patch)
    .eq("id", groupId)
    .select("*")
    .single();
  if (error) throw error;
  await logAudit({
    groupId,
    actorType: "admin",
    actorId: actorMembershipId,
    eventType: "group_settings_updated",
    entityType: "group",
    entityId: groupId,
    before,
    after: patch,
  });
  return data;
}

/** Applies each group's raw-payload retention window to stored observations. */
export async function pruneRetention(): Promise<{ groups: number; prunedObservations: number }> {
  const db = await admin();
  const { data: groups } = await db
    .from("groups")
    .select("id, raw_message_retention_days")
    .is("removed_at", null);

  let prunedObservations = 0;
  for (const group of groups ?? []) {
    const days = Number(group.raw_message_retention_days ?? 30);
    if (!Number.isFinite(days) || days <= 0) continue;
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data: calls } = await db.from("calls").select("id").eq("group_id", group.id);
    const callIds = (calls ?? []).map((c: any) => c.id);
    if (callIds.length === 0) continue;

    const { data: pruned } = await db
      .from("market_observations")
      .update({ raw: null })
      .lt("observed_at", cutoff)
      .not("raw", "is", null)
      .in("call_id", callIds)
      .select("id");
    prunedObservations += pruned?.length ?? 0;

    await db
      .from("audit_events")
      .update({ before_state: null, after_state: null })
      .eq("group_id", group.id)
      .lt("created_at", cutoff)
      .not("after_state", "is", null);
  }

  return { groups: groups?.length ?? 0, prunedObservations };
}

/** Removes expired one-shot credentials so nothing lingers past its window. */
export async function purgeExpiredCredentials(): Promise<void> {
  const db = await admin();
  const now = new Date().toISOString();
  await db.from("miniapp_login_tokens").delete().lt("expires_at", now);
  await db.from("miniapp_sessions").delete().lt("expires_at", now);
  await db.from("wallet_challenges").delete().lt("expires_at", now).is("consumed_at", null);
}
