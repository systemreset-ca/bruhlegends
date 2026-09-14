import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("../src/lib/db.server", () => ({ admin: vi.fn() }));
import { admin } from "../src/lib/db.server";
import { getCommunityLeaderboard } from "../src/lib/community-leaderboard.server";
const rpc = vi.fn();
const row = {
  telegramUserId: "123",
  displayName: "alice",
  calls: 3,
  uniqueTokens: 3,
  bestMultiple: 4,
  medianMultiple: 3,
  milestones: 2,
  tipsSent: 1,
  tipsReceived: 2,
  groups: 2,
  ranked: true,
  score: 45,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SOLANA_NETWORK", "devnet");
  vi.mocked(admin).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof admin>>);
});
afterEach(() => vi.unstubAllEnvs());
it("requests bounded account-wide ranking without a group filter", async () => {
  rpc.mockResolvedValue({ data: [{ ...row, privateWalletAddress: "not for clients" }] });
  expect(await getCommunityLeaderboard("7d", "tippers")).toEqual([row]);
  expect(rpc).toHaveBeenCalledWith("bruh_community_leaderboard", {
    p_window: "7d",
    p_limit: 10,
    p_network: "devnet",
    p_order: "tippers",
  });
});
it("rejects duplicate accounts, malformed stats and unavailable RPC without partial rankings", async () => {
  for (const result of [
    { data: [row, row] },
    { data: [{ ...row, calls: -1 }] },
    { data: [{ ...row, score: NaN }] },
    { error: { message: "private database detail" } },
  ]) {
    rpc.mockResolvedValue(result);
    await expect(getCommunityLeaderboard()).rejects.toThrow();
  }
});
it("rejects invalid limits and networks before querying", async () => {
  await expect(getCommunityLeaderboard("all", "callers", 101)).rejects.toThrow();
  vi.stubEnv("SOLANA_NETWORK", "wrong");
  await expect(getCommunityLeaderboard()).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
