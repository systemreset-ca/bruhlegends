import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  send: vi.fn(),
  answer: vi.fn(),
  prepare: vi.fn(),
  rpc: vi.fn(),
  login: vi.fn(),
  member: vi.fn(),
}));
vi.mock("../src/lib/telegram.server", () => ({
  sendMessage: m.send,
  answerCallbackQuery: m.answer,
  escapeHtml: (s: string) => s,
  isChatAdmin: vi.fn(),
}));
vi.mock("../src/lib/db.server", () => ({
  admin: async () => ({ rpc: m.rpc }),
  upsertGroup: async () => ({ id: "g1", is_paused: false }),
  upsertMember: m.member,
}));
vi.mock("../src/lib/account-wallet.server", () => ({
  accountWalletsEnabled: () => true,
  accountWalletForTelegram: vi.fn(),
}));
vi.mock("../src/lib/account-tip-preparation.server", () => ({ prepareAccountTip: m.prepare }));
vi.mock("../src/lib/session.server", () => ({ createLoginToken: m.login }));
import { handleUpdate } from "../src/lib/bot.server";
import { accountWalletForTelegram } from "../src/lib/account-wallet.server";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(accountWalletForTelegram).mockResolvedValue({
    id: "wallet",
    address: "synthetic-address",
    network: "devnet",
  });
  vi.stubEnv("SOLANA_NETWORK", "devnet");
  vi.stubEnv("BRUH_ACCOUNT_TIPS_DEVNET_ENABLED", "true");
  vi.stubEnv("BRUH_ACCOUNT_SIGNING_DEVNET_ENABLED", "true");
  m.member.mockResolvedValue({ id: "member", is_banned: false });
  m.prepare.mockResolvedValue({ id, state: "reserved", reused: false });
  m.login.mockResolvedValue("synthetic-private-login");
  m.rpc.mockResolvedValue({ data: { sender_user_id: 123 } });
});
it("opens password and wallet setup inside the private Mini App without generating in chat", async () => {
  await handleUpdate({
    update_id: 5,
    message: {
      message_id: 5,
      chat: { id: 123, type: "private" },
      from: { id: 123 },
      text: "/security",
    },
  });
  expect(accountWalletForTelegram).not.toHaveBeenCalled();
  expect(m.login).toHaveBeenCalledWith(123, null);
  expect(m.send.mock.calls.at(-1)?.[1]).toContain("Open the BRUH Mini App");
});
afterEach(() => vi.unstubAllEnvs());
const tip = (text = "/tip 0.001 SOL", target = 456) =>
  handleUpdate({
    update_id: 1,
    message: {
      message_id: 2,
      chat: { id: -100123, type: "group" },
      from: { id: 123 },
      text,
      reply_to_message: {
        message_id: 1,
        chat: { id: -100123, type: "group" },
        from: { id: target },
      },
    },
  });
it("reserves from verified webhook IDs and keeps private tokens out of group replies", async () => {
  await tip();
  expect(m.prepare).toHaveBeenCalledWith({
    telegramChatId: -100123,
    telegramMessageId: 2,
    senderUserId: 123,
    recipientUserId: 456,
    amount: "0.001",
  });
  expect(m.login).not.toHaveBeenCalled();
  expect(m.send).toHaveBeenCalledWith(
    -100123,
    expect.any(String),
    expect.objectContaining({
      keyboard: [[{ text: "Review privately", callback_data: `accounttip:${id}` }]],
    }),
  );
});
it("rejects self tips, unsupported assets and disabled signing before reserving", async () => {
  await tip("/tip 1 SOL", 123);
  await tip("/tip 1 USDC");
  vi.stubEnv("BRUH_ACCOUNT_SIGNING_DEVNET_ENABLED", "false");
  await tip();
  expect(m.prepare).not.toHaveBeenCalled();
});
it("delivers the web_app button only to its authenticated sender, never the source group", async () => {
  await handleUpdate({
    update_id: 2,
    callback_query: {
      id: "cb",
      from: { id: 123 },
      data: `accounttip:${id}`,
      message: { message_id: 3, chat: { id: -100123, type: "group" } },
    },
  });
  expect(m.login).toHaveBeenCalledWith(123, null);
  expect(m.send).toHaveBeenCalledWith(
    123,
    expect.any(String),
    expect.objectContaining({
      keyboard: [
        [
          {
            text: "Review tip",
            web_app: {
              url: expect.stringContaining("/wallet-action?t=synthetic-private-login&tip="),
            },
          },
        ],
      ],
    }),
  );
  m.send.mockClear();
  m.login.mockClear();
  m.rpc.mockResolvedValue({ data: null });
  await handleUpdate({
    update_id: 3,
    callback_query: { id: "cb2", from: { id: 456 }, data: `accounttip:${id}` },
  });
  expect(m.login).not.toHaveBeenCalled();
  expect(m.send).not.toHaveBeenCalled();
});

it("shows private Secure Action Password instructions when devnet spending is enabled", async () => {
  await handleUpdate({
    update_id: 4,
    message: {
      message_id: 4,
      chat: { id: 123, type: "private" },
      from: { id: 123 },
      text: "/help",
    },
  });
  expect(m.send.mock.calls.at(-1)?.[1]).toContain("Secure Action Password approval");
});
