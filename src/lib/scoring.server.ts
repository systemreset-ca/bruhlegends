import { admin } from "./db.server";

export type LeaderboardRow = {
  membershipId: string;
  displayName: string;
  calls: number;
  bestMultiple: number;
  medianMultiple: number;
  milestones: number;
  tipsReceived: number;
  ranked: boolean;
  score: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

/**
 * BRUH Score: performance, consistency and peer recognition, damped by sample
 * size so a single lucky call cannot top a group.
 */
export function bruhScore(input: {
  calls: number;
  multiples: number[];
  milestones: number;
  tipsReceived: number;
}): number {
  if (input.calls === 0) return 0;
  const best = Math.max(...input.multiples, 0);
  const mid = median(input.multiples);
  const hitRate = input.multiples.filter((m) => m >= 2).length / input.calls;
  const confidence = input.calls / (input.calls + 3);

  const performance = Math.log10(1 + best) * 40 + Math.log10(1 + mid) * 30;
  const consistency = hitRate * 25;
  const recognition = Math.log10(1 + input.tipsReceived) * 10;
  const milestoneBonus = Math.log10(1 + input.milestones) * 8;

  return Number(
    ((performance + consistency + milestoneBonus) * confidence + recognition).toFixed(2),
  );
}

export type LeaderboardWindow = "7d" | "30d" | "all";

/** Pure: the ISO cutoff a window implies, or null for all-time. */
export function windowCutoff(window: LeaderboardWindow, now = new Date()): string | null {
  if (window === "all") return null;
  const days = window === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60_000).toISOString();
}

/** Minimum calls in a window before a member is ranked rather than listed. */
export const MIN_SAMPLE = 3;

/** Local group view. Community aggregation is a separate account-keyed projection. */
export async function getLeaderboard(
  groupId: string,
  limit = 10,
  seasonId?: string | null,
  window: LeaderboardWindow = "all",
): Promise<LeaderboardRow[]> {
  const db = await admin();
  const cutoff = windowCutoff(window);
  const { data: members } = await db
    .from("group_members")
    .select("id, display_name")
    .eq("group_id", groupId)
    .eq("is_banned", false);

  let callQuery = db
    .from("calls")
    .select("id, caller_membership_id, ath_multiple, status")
    .eq("group_id", groupId)
    .in("status", ["active", "rugged_or_illiquid", "archived"]);
  if (seasonId) callQuery = callQuery.eq("season_id", seasonId);
  if (cutoff) callQuery = callQuery.gte("created_at", cutoff);
  const { data: calls } = await callQuery;

  const { data: milestones } = await db
    .from("milestones")
    .select("call_id")
    .in(
      "call_id",
      (calls ?? []).map((c: { id: string }) => c.id),
    );

  let tipQuery = db
    .from("tip_intents")
    .select("recipient_membership_id")
    .eq("group_id", groupId)
    .eq("status", "confirmed");
  if (cutoff) tipQuery = tipQuery.gte("created_at", cutoff);
  const { data: tips } = await tipQuery;

  const milestoneByCall = new Map<string, number>();
  for (const row of milestones ?? []) {
    milestoneByCall.set(row.call_id, (milestoneByCall.get(row.call_id) ?? 0) + 1);
  }
  const tipCounts = new Map<string, number>();
  for (const tip of tips ?? []) {
    tipCounts.set(
      tip.recipient_membership_id,
      (tipCounts.get(tip.recipient_membership_id) ?? 0) + 1,
    );
  }

  const rows: LeaderboardRow[] = (members ?? []).map(
    (member: { id: string; display_name: string }) => {
      const own = (calls ?? []).filter(
        (call: { caller_membership_id: string }) => call.caller_membership_id === member.id,
      );
      const multiples = own.map((call: { ath_multiple: number | null }) =>
        Number(call.ath_multiple ?? 1),
      );
      const memberMilestones = own.reduce(
        (total: number, call: { id: string }) => total + (milestoneByCall.get(call.id) ?? 0),
        0,
      );
      const tipsReceived = tipCounts.get(member.id) ?? 0;

      return {
        membershipId: member.id,
        displayName: member.display_name,
        calls: own.length,
        bestMultiple: Math.max(...multiples, 0),
        medianMultiple: median(multiples),
        milestones: memberMilestones,
        tipsReceived,
        // Below the minimum sample a member is shown but not ranked above
        // people with a real track record in the window.
        ranked: own.length >= MIN_SAMPLE,
        score: bruhScore({
          calls: own.length,
          multiples,
          milestones: memberMilestones,
          tipsReceived,
        }),
      };
    },
  );

  return rows
    .filter((row) => row.calls > 0 || row.tipsReceived > 0)
    .sort((a, b) => (a.ranked === b.ranked ? b.score - a.score : a.ranked ? -1 : 1))
    .slice(0, limit);
}

export async function getMemberStats(groupId: string, membershipId: string) {
  const board = await getLeaderboard(groupId, 1000);
  const index = board.findIndex((row) => row.membershipId === membershipId);
  return {
    rank: index >= 0 ? index + 1 : null,
    total: board.length,
    row: index >= 0 ? board[index] : null,
  };
}
