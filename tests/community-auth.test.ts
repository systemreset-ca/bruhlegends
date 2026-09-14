import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/lib/session.server", () => ({ resolveSession: vi.fn() }));
vi.mock("../src/lib/community-leaderboard.server", () => ({ getCommunityLeaderboard: vi.fn() }));
import { resolveSession } from "../src/lib/session.server";
import { getCommunityLeaderboard } from "../src/lib/community-leaderboard.server";
import { loadCommunityBoard } from "../src/lib/miniapp.server";
beforeEach(() => vi.clearAllMocks());
it("rejects missing server session before reading any community projection", async () => {
  vi.mocked(resolveSession).mockResolvedValue(null);
  await expect(loadCommunityBoard({ session: "invalid-session" })).rejects.toThrow(
    "Session expired",
  );
  expect(getCommunityLeaderboard).not.toHaveBeenCalled();
});
it("allows authenticated community view without accepting a group or wallet identity", async () => {
  vi.mocked(resolveSession).mockResolvedValue({ telegramUserId: 123, groupId: "g1" });
  vi.mocked(getCommunityLeaderboard).mockResolvedValue([]);
  expect(
    await loadCommunityBoard({ session: "valid-session", window: "30d", kind: "tippers" }),
  ).toEqual({ leaderboard: [] });
  expect(getCommunityLeaderboard).toHaveBeenCalledWith("30d", "tippers");
});
