import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  answer: vi.fn(),
  wallet: vi.fn(),
  balance: vi.fn(),
}));
vi.mock("../src/lib/telegram.server", () => ({
  sendMessage: mocks.send,
  answerCallbackQuery: mocks.answer,
  escapeHtml: (text: string) => text,
  isChatAdmin: vi.fn(),
}));
vi.mock("../src/lib/account-wallet.server", () => ({
  accountWalletsEnabled: () => true,
  accountWalletForTelegram: mocks.wallet,
}));
vi.mock("../src/lib/account-wallet-balance.server", () => ({
  accountWalletBalance: mocks.balance,
}));
import { handleUpdate } from "../src/lib/bot.server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.wallet.mockResolvedValue({ id: "wallet", address: "public-address", network: "devnet" });
  mocks.balance.mockResolvedValue("0");
});
function command(text: string, chatId = 123) {
  return handleUpdate({
    update_id: 1,
    message: { message_id: 1, chat: { id: chatId, type: "private" }, from: { id: 123 }, text },
  });
}
describe("private account-wallet commands", () => {
  it("creates on private start and only reads on wallet show", async () => {
    await command("/start");
    expect(mocks.wallet).toHaveBeenLastCalledWith(123, true);
    await command("/wallet show");
    expect(mocks.wallet).toHaveBeenLastCalledWith(123, false);
    expect(mocks.send.mock.calls.at(-1)?.[1]).toContain("Finalized balance: 0 devnet SOL");
  });
  it("requires make confirmation before creating", async () => {
    await command("/wallet make");
    expect(mocks.wallet).not.toHaveBeenCalled();
    await handleUpdate({
      update_id: 2,
      callback_query: {
        id: "cb",
        from: { id: 123 },
        data: "accountwallet:make",
        message: { message_id: 2, chat: { id: 123, type: "private" } },
      },
    });
    expect(mocks.wallet).toHaveBeenCalledWith(123, true);
  });
  it("denies another user's private chat and group creation callbacks", async () => {
    await command("/start", 456);
    await handleUpdate({
      update_id: 2,
      callback_query: {
        id: "cb",
        from: { id: 123 },
        data: "accountwallet:make",
        message: { message_id: 2, chat: { id: -123, type: "group" } },
      },
    });
    expect(mocks.wallet).not.toHaveBeenCalled();
  });
  it("does not export keys or destroy a wallet through placeholders", async () => {
    await command("/wallet keys");
    await command("/wallet destroy");
    expect(mocks.wallet).not.toHaveBeenCalled();
    expect(mocks.send.mock.calls[0]?.[1]).toContain("not enabled");
    expect(mocks.send.mock.calls[1]?.[1]).toContain("unchanged");
  });
  it("shows unavailable balance honestly and never renders storage errors", async () => {
    mocks.balance.mockRejectedValue(new Error("synthetic-private-provider-error"));
    await command("/wallet show");
    expect(mocks.send.mock.calls[0]?.[1]).toContain("Balance unavailable");
    mocks.wallet.mockRejectedValue(new Error("synthetic-private-storage-error"));
    await command("/start");
    expect(mocks.send.mock.calls[1]?.[1]).not.toContain("synthetic-private");
  });
});
