import { admin } from "./db.server";
import type { LeaderboardWindow } from "./scoring.server";

export type CommunityBoardKind = "callers" | "tippers";
export type CommunityLeaderboardRow = {
  telegramUserId: string;
  displayName: string;
  calls: number;
  uniqueTokens: number;
  bestMultiple: number;
  medianMultiple: number;
  milestones: number;
  tipsSent: number;
  tipsReceived: number;
  groups: number;
  ranked: boolean;
  score: number;
};
export async function getCommunityLeaderboard(
  window: LeaderboardWindow = "all",
  kind: CommunityBoardKind = "callers",
  limit = 10,
) {
  const network = process.env["SOLANA_NETWORK"];
  if (
    !["all", "7d", "30d"].includes(window) ||
    !["callers", "tippers"].includes(kind) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !["devnet", "mainnet-beta"].includes(network ?? "")
  )
    throw new Error("Community ranking unavailable.");
  const db = await admin();
  const result = await db.rpc("bruh_community_leaderboard", {
    p_window: window,
    p_limit: limit,
    p_network: network,
    p_order: kind,
  });
  if (result.error || !Array.isArray(result.data) || result.data.length > limit)
    throw new Error("Community ranking unavailable.");
  const seen = new Set<string>();
  for (const row of result.data as CommunityLeaderboardRow[]) {
    if (
      !row ||
      typeof row.telegramUserId !== "string" ||
      !/^[1-9][0-9]{0,15}$/.test(row.telegramUserId) ||
      BigInt(row.telegramUserId) > 4503599627370495n ||
      seen.has(row.telegramUserId) ||
      typeof row.displayName !== "string" ||
      typeof row.ranked !== "boolean" ||
      [
        row.calls,
        row.uniqueTokens,
        row.milestones,
        row.tipsSent,
        row.tipsReceived,
        row.groups,
      ].some((n) => !Number.isSafeInteger(n) || n < 0) ||
      [row.bestMultiple, row.medianMultiple, row.score].some((n) => !Number.isFinite(n) || n < 0)
    )
      throw new Error("Invalid community ranking.");
    seen.add(row.telegramUserId);
  }
  // Explicit projection prevents future RPC fields from exposing private source data.
  return (result.data as CommunityLeaderboardRow[]).map((row) => ({
    telegramUserId: row.telegramUserId,
    displayName: row.displayName,
    calls: row.calls,
    uniqueTokens: row.uniqueTokens,
    bestMultiple: row.bestMultiple,
    medianMultiple: row.medianMultiple,
    milestones: row.milestones,
    tipsSent: row.tipsSent,
    tipsReceived: row.tipsReceived,
    groups: row.groups,
    ranked: row.ranked,
    score: row.score,
  }));
}
