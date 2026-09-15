import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  answer: vi.fn(),
  edit: vi.fn(),
  wallet: vi.fn(),
  balance: vi.fn(),
}));
vi.mock("../src/lib/telegram.server", () => ({
  sendMessage: mocks.send,
  editMessageText: mocks.edit,
  answerCallbackQuery: mocks.answer,
  escapeHtml: (text: string) => text,
  isChatAdmin: vi.fn(),
}));
vi.mock("../src/lib/session.server", () => ({
  createLoginToken: vi.fn(async () => "synthetic-private-token"),
}));
vi.mock("../src/lib/account-wallet.server", () => ({
  accountWalletsEnabled: () => true,
  accountWalletForTelegram: mocks.wallet,
}));
vi.mock("../src/lib/account-wallet-balance.server", () => ({
  accountWalletBalance: mocks.balance,
}));
import { handleUpdate } from "../src/lib/bot.server";
vi.mock("../src/lib/account-external-wallet.server", () => ({ accountExternalWallet: vi.fn() }));
import { accountExternalWallet } from "../src/lib/account-external-wallet.server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.wallet.mockResolvedValue({ id: "wallet", address: "public-address", network: "devnet" });
  mocks.balance.mockResolvedValue("0");
});
afterEach(() => vi.unstubAllEnvs());
function command(text: string, chatId = 123) {
  return handleUpdate({
    update_id: 1,
    message: { message_id: 1, chat: { id: chatId, type: "private" }, from: { id: 123 }, text },
  });
}
describe("private account-wallet commands", () => {
  it("opens the private Mini App without generating for an old generation callback", async () => {
    await handleUpdate({
      update_id: 3,
      callback_query: {
        id: "cb",
        from: { id: 123 },
        data: "accountwallet:make",
        message: { message_id: 2, chat: { id: 123, type: "private" } },
      },
    });
    expect(mocks.wallet).not.toHaveBeenCalled();
    expect(mocks.send.mock.calls.at(-1)?.[2].keyboard[0][0].web_app.url).toContain(
      "/wallet-action?t=synthetic-private-token",
    );
  });
  it("generates through the same account wallet and rejects extra arguments", async () => {
    await command("/generate");
    expect(mocks.wallet).not.toHaveBeenCalled();
    mocks.wallet.mockClear();
    await command("/generate another-wallet");
    expect(mocks.wallet).not.toHaveBeenCalled();
  });
  it("registers only a private external candidate without creating or authorizing internal spending", async () => {
    vi.mocked(accountExternalWallet).mockResolvedValue({
      telegramUserId: "123",
      address: "public-external-address",
      network: "devnet",
      status: "unverified",
    });
    await command("/wallet add public-external-address");
    expect(accountExternalWallet).toHaveBeenCalledWith(123, "public-external-address");
    expect(mocks.wallet).not.toHaveBeenCalled();
    expect(mocks.send.mock.calls.at(-1)?.[1]).toContain("unverified");
    expect(mocks.send.mock.calls.at(-1)?.[1]).toContain("withdrawals to it are not enabled");
    vi.mocked(accountExternalWallet).mockClear();
    await command("/wallet add address extra");
    await command("/wallet add address", 456);
    expect(accountExternalWallet).not.toHaveBeenCalled();
  });
  it("welcomes new private accounts without creating and only reads on wallet show", async () => {
    await command("/start");
    expect(mocks.wallet).not.toHaveBeenCalled();
    expect(mocks.send.mock.calls.at(-1)?.[1]).toContain("Welcome to BRUH Legends");
    expect(mocks.send.mock.calls.at(-1)?.[2].keyboard[0][0].text).toBe("Open BRUH Wallet Mini App");
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
    expect(mocks.wallet).not.toHaveBeenCalled();
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
