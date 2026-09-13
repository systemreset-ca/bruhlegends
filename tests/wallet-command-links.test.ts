import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), admin: vi.fn(), login: vi.fn() }));
vi.mock("../src/lib/db.server", () => ({
  admin: mocks.admin,
  upsertGroup: vi.fn(),
  upsertMember: vi.fn(),
  migrateChatId: vi.fn(),
  logAudit: vi.fn(),
}));
vi.mock("../src/lib/session.server", () => ({ createLoginToken: mocks.login }));
vi.mock("../src/lib/telegram.server", () => ({
  sendMessage: mocks.send,
  answerCallbackQuery: vi.fn(),
  escapeHtml: (text: string) => text,
  isChatAdmin: vi.fn(),
}));
import { handleUpdate } from "../src/lib/bot.server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.login.mockResolvedValue("synthetic-login-token");
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [{ id: "membership" }] }),
  };
  mocks.admin.mockResolvedValue({ from: () => query });
});
afterEach(() => vi.unstubAllEnvs());
async function walletCommand(text = "/wallet") {
  await handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      chat: { id: 42, type: "private" },
      from: { id: 42 },
      text,
    },
  });
  return mocks.send.mock.calls[0];
}
describe("wallet app links", () => {
  it.each([undefined, "", "   "])(
    "uses the public production origin with APP_URL=%s",
    async (value) => {
      vi.stubEnv("APP_URL", value);
      const reply = await walletCommand();
      expect(reply[2].keyboard[0][0].url).toBe("https://bruh.tips/app?t=synthetic-login-token");
      expect(reply[1]).toContain("Pasting an address here does not link it");
      expect(mocks.login).toHaveBeenCalledWith(42, null);
    },
  );
  it("normalizes an explicit deployment URL and still requires ownership signing", async () => {
    vi.stubEnv("APP_URL", " https://staging.example.test/ ");
    const reply = await walletCommand("/wallet pasted-address");
    expect(reply[2].keyboard[0][0].url).toBe(
      "https://staging.example.test/app?t=synthetic-login-token",
    );
    expect(reply[1]).toContain("sign a one-off message");
  });
});
