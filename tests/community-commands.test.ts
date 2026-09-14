import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/lib/telegram.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/telegram.server")>()),
  sendMessage: vi.fn(),
}));
vi.mock("../src/lib/db.server", () => ({
  admin: vi.fn(),
  upsertGroup: vi.fn(),
  upsertMember: vi.fn(),
  logAudit: vi.fn(),
  migrateChatId: vi.fn(),
}));
vi.mock("../src/lib/scoring.server", () => ({ getLeaderboard: vi.fn(), getMemberStats: vi.fn() }));
vi.mock("../src/lib/community-leaderboard.server", () => ({ getCommunityLeaderboard: vi.fn() }));
import { handleUpdate } from "../src/lib/bot.server";
import { sendMessage } from "../src/lib/telegram.server";
import { upsertGroup, upsertMember } from "../src/lib/db.server";
import { getLeaderboard } from "../src/lib/scoring.server";
import { getCommunityLeaderboard } from "../src/lib/community-leaderboard.server";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCommunityLeaderboard).mockResolvedValue([]);
  vi.mocked(getLeaderboard).mockResolvedValue([]);
  vi.mocked(upsertGroup).mockResolvedValue({ id: "g1", title: "Group", is_paused: false });
  vi.mocked(upsertMember).mockResolvedValue({ id: "m1", is_banned: false });
});
const command = (text: string, type = "private") =>
  handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      chat: { id: type === "private" ? 123 : -100123, type },
      from: { id: 123 },
      text,
    },
  });
it("routes private leaderboards and group global aliases to the community view", async () => {
  await command("/leaderboard 7d");
  expect(getCommunityLeaderboard).toHaveBeenLastCalledWith("7d", "callers");
  await command("/leaderboard global tippers 30d", "group");
  expect(getCommunityLeaderboard).toHaveBeenLastCalledWith("30d", "tippers");
  expect(getLeaderboard).not.toHaveBeenCalled();
});
it("retains local group rankings and respects group pause for community commands", async () => {
  await command("/leaderboard 7d", "group");
  expect(getLeaderboard).toHaveBeenCalledWith("g1", 10, null, "7d");
  expect(getCommunityLeaderboard).not.toHaveBeenCalled();
  vi.mocked(upsertGroup).mockResolvedValue({ id: "g1", title: "Group", is_paused: true });
  await command("/community", "group");
  expect(getCommunityLeaderboard).not.toHaveBeenCalled();
});
it("rejects invalid community arguments and reports RPC outages without a fake board", async () => {
  await command("/community wrong");
  expect(getCommunityLeaderboard).not.toHaveBeenCalled();
  expect(sendMessage).toHaveBeenLastCalledWith(123, expect.stringContaining("Usage:"));
  vi.mocked(getCommunityLeaderboard).mockRejectedValue(new Error("internal detail"));
  await command("/community");
  expect(sendMessage).toHaveBeenLastCalledWith(
    123,
    expect.stringContaining("temporarily unavailable"),
  );
});
