import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  group: vi.fn(),
  member: vi.fn(),
  admin: vi.fn(),
}));

vi.mock("../src/lib/db.server", () => ({
  admin: mocks.admin,
  upsertGroup: mocks.group,
  upsertMember: mocks.member,
  migrateChatId: vi.fn(),
  logAudit: vi.fn(),
}));
vi.mock("../src/lib/telegram.server", () => ({
  sendMessage: mocks.send,
  answerCallbackQuery: vi.fn(),
  escapeHtml: (text: string) =>
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  isChatAdmin: vi.fn(),
}));

import { handleUpdate } from "../src/lib/bot.server";

function update(type: string = "supergroup", text = "/credits") {
  return {
    update_id: 44,
    message: { message_id: 77, chat: { id: -10042, type }, from: { id: 42 }, text },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BRUH_PARTICIPATION_STORAGE_ENABLED", "false");
  mocks.group.mockResolvedValue({ id: "group-a", is_paused: false });
  mocks.member.mockResolvedValue({ id: "member-a", is_banned: false });
});
afterEach(() => vi.unstubAllEnvs());

describe("inactive credits command", () => {
  it("responds in a DM without querying memberships, balances or RPC", async () => {
    await handleUpdate(update("private"));
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send.mock.calls[0]?.[1]).toContain("No points are being awarded");
    expect(mocks.send.mock.calls[0]?.[1]).toContain("not BRUH tokens");
    expect(mocks.group).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("handles a bot-mentioned command in its group context", async () => {
    await handleUpdate(update("supergroup", "/credits@BRUHLegendsBot"));
    expect(mocks.member).toHaveBeenCalledWith("group-a", { id: 42 });
    expect(mocks.send).toHaveBeenCalledWith(-10042, expect.any(String), { replyToMessageId: 77 });
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("preserves group pause and member ban controls", async () => {
    mocks.group.mockResolvedValueOnce({ id: "group-a", is_paused: true });
    await handleUpdate(update());
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.member.mockResolvedValueOnce({ id: "member-a", is_banned: true });
    await handleUpdate(update());
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
