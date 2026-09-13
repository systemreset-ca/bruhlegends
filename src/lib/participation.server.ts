import { admin } from "./db.server";

/** Deployment switch permits storage use; it cannot activate an earning season. */
export function participationStorageEnabled(): boolean {
  return process.env["BRUH_PARTICIPATION_STORAGE_ENABLED"] === "true";
}

export type ParticipationEvent = {
  id: string;
  season_id: string;
  source_kind: string;
  rule_version: string;
  status: "awarded" | "held" | "adjustment";
  points: number;
  reason_code: string;
  created_at: string;
};

export type ParticipationSummary = {
  storageReady: boolean;
  earningEnabled: boolean;
  totalPoints: number;
  pendingTips: number;
  tipsNeedingReview: number;
  events: ParticipationEvent[];
  seasons: {
    id: string;
    name: string;
    rule_version: string;
    network: string;
    status: string;
    approval_record: string | null;
  }[];
};

export async function loadParticipation(
  groupId: string,
  membershipId: string,
): Promise<ParticipationSummary> {
  if (!participationStorageEnabled()) {
    return {
      storageReady: false,
      earningEnabled: false,
      totalPoints: 0,
      pendingTips: 0,
      tipsNeedingReview: 0,
      events: [],
      seasons: [],
    };
  }
  const db = await admin();
  const member = await db
    .from("group_members")
    .select("group_id,is_banned,participation_opt_out,groups(is_paused,removed_at)")
    .eq("id", membershipId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (member.error) throw new Error("Participation membership lookup failed.");
  if (!member.data || member.data.is_banned || member.data.participation_opt_out) {
    throw new Error("Participation is unavailable for this membership.");
  }
  const [history, seasons, totals, jobs] = await Promise.all([
    db
      .from("participation_events")
      .select("id,season_id,source_kind,rule_version,status,points,reason_code,created_at")
      .eq("group_id", groupId)
      .eq("membership_id", membershipId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("participation_seasons")
      .select("id,name,rule_version,network,status,approval_record,starts_at,ends_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(20),
    db.rpc("participation_member_total", { p_group: groupId, p_member: membershipId }),
    db.rpc("participation_member_job_counts", { p_group: groupId, p_member: membershipId }),
  ]);
  if (history.error || seasons.error || totals.error || jobs.error)
    throw new Error("Participation ledger lookup failed.");
  if (totals.data === null || !["string", "number"].includes(typeof totals.data)) {
    throw new Error("Invalid participation total.");
  }
  const totalPoints = Number(totals.data);
  if (!Number.isSafeInteger(totalPoints) || totalPoints < 0)
    throw new Error("Invalid participation total.");
  if (
    !jobs.data ||
    !Number.isSafeInteger(jobs.data.pending) ||
    !Number.isSafeInteger(jobs.data.needsReview) ||
    jobs.data.pending < 0 ||
    jobs.data.needsReview < 0
  ) {
    throw new Error("Invalid participation job counts.");
  }
  const now = Date.now();
  return {
    storageReady: true,
    earningEnabled:
      !member.data.groups?.is_paused &&
      !member.data.groups?.removed_at &&
      (seasons.data ?? []).some(
        (s: { status: string; starts_at: string; ends_at: string }) =>
          s.status === "active" && Date.parse(s.starts_at) <= now && Date.parse(s.ends_at) > now,
      ),
    totalPoints,
    pendingTips: jobs.data.pending,
    tipsNeedingReview: jobs.data.needsReview,
    events: (history.data ?? []) as ParticipationEvent[],
    seasons: seasons.data ?? [],
  };
}

/** Called by controlled server workflows only. Not exposed as a client/server function. */
export async function awardParticipation(input: {
  seasonId: string;
  membershipId: string;
  sourceKind: string;
  sourceId: string;
}) {
  if (!participationStorageEnabled()) throw new Error("Participation storage is disabled.");
  const db = await admin();
  const result = await db.rpc("award_participation", {
    p_season: input.seasonId,
    p_member: input.membershipId,
    p_kind: input.sourceKind,
    p_source: input.sourceId,
  });
  if (result.error) throw new Error("Participation award failed.");
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row || !["awarded", "held"].includes(row.status) || !Number.isSafeInteger(row.points)) {
    throw new Error("Invalid participation award response.");
  }
  return row as ParticipationEvent;
}

export async function processParticipationJobs(): Promise<{ processed: number; failed: number }> {
  if (!participationStorageEnabled()) return { processed: 0, failed: 0 };
  const db = await admin();
  const result = await db.rpc("process_participation_jobs", { p_limit: 20 });
  if (result.error) throw new Error("Participation worker failed.");
  const row = result.data;
  if (
    !row ||
    !Number.isInteger(row.processed) ||
    !Number.isInteger(row.failed) ||
    row.processed < 0 ||
    row.failed < 0 ||
    row.processed + row.failed > 20
  ) {
    throw new Error("Invalid participation worker response.");
  }
  return { processed: row.processed, failed: row.failed };
}
