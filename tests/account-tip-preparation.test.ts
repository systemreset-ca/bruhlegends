import { afterEach, beforeEach, expect, it, vi } from "vitest";
import bs58 from "bs58";
vi.mock("../src/lib/db.server", () => ({ admin: vi.fn() }));
vi.mock("../src/lib/account-wallet.server", () => ({
  accountWalletsEnabled: vi.fn(),
  accountWalletForTelegram: vi.fn(),
}));
vi.mock("../src/lib/account-wallet-balance.server", () => ({ readDevnetAccount: vi.fn() }));
import { admin } from "../src/lib/db.server";
import { accountWalletsEnabled, accountWalletForTelegram } from "../src/lib/account-wallet.server";
import { readDevnetAccount } from "../src/lib/account-wallet-balance.server";
import { prepareAccountTip } from "../src/lib/account-tip-preparation.server";
import { accountTipLamports, buildAccountSolTipMessage } from "../src/lib/account-sol-tip-message";
const address = (n: number) => bs58.encode(new Uint8Array(32).fill(n));
const input = {
  telegramChatId: -100123,
  telegramMessageId: 77,
  senderUserId: 123,
  recipientUserId: 456,
  amount: "1.000000001",
};
const group = { id: "g1", telegram_chat_id: -100123, is_paused: false, removed_at: null };
const members = [123, 456].map((id) => ({
  group_id: "g1",
  telegram_user_id: id,
  is_banned: false,
  pseudonym: null,
}));
let groupData: unknown, memberData: unknown;
const rpc = vi.fn();
const from = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SOLANA_NETWORK", "devnet");
  vi.stubEnv("BRUH_ACCOUNT_TIPS_DEVNET_ENABLED", "true");
  vi.mocked(accountWalletsEnabled).mockReturnValue(true);
  groupData = group;
  memberData = members;
  from.mockImplementation((table) => {
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      maybeSingle: vi.fn(async () => ({ data: groupData })),
      in: vi.fn(async () => ({ data: memberData })),
    };
    expect(["groups", "group_members"]).toContain(table);
    return q;
  });
  vi.mocked(admin).mockResolvedValue({ rpc, from });
  vi.mocked(accountWalletForTelegram).mockImplementation(async (user) => ({
    id: String(user),
    address: address(user === 123 ? 1 : 2),
    network: "devnet",
  }));
  rpc.mockImplementation(async (name, args) =>
    name === "bruh_account_tip_find_request"
      ? { data: null }
      : {
          data: {
            ...args.p_record,
            state: "reserved",
            sender_address: address(1),
            recipient_address: address(2),
            fee_lamports: args.p_record.feeLamports,
          },
        },
  );
  vi.mocked(readDevnetAccount)
    .mockResolvedValueOnce({
      context: { slot: 100 },
      value: { blockhash: address(4), lastValidBlockHeight: 200 },
    })
    .mockResolvedValueOnce({ context: { slot: 100 }, value: 5000 })
    .mockResolvedValueOnce({ context: { slot: 101 }, value: 1000010000 });
});
afterEach(() => vi.unstubAllEnvs());
it("builds the same narrow referenced wire message used by the finalized devnet exercise", () => {
  expect(accountTipLamports("0.000000001")).toBe(1n);
  expect(accountTipLamports("1.000000001")).toBe(1000000001n);
  const message = buildAccountSolTipMessage({
    network: "devnet",
    sender: address(1),
    recipient: address(2),
    reference: address(3),
    blockhash: address(4),
    lamports: 1000000001n,
  });
  expect(message.length).toBe(183);
  expect(Array.from(message.slice(0, 4))).toEqual([1, 0, 2, 4]);
  expect(bs58.encode(message.slice(68, 100))).toBe(address(3));
  expect(Array.from(message.slice(164, 171))).toEqual([1, 3, 3, 0, 1, 2, 12]);
  const data = new DataView(message.buffer, 171, 12);
  expect(data.getUint32(0, true)).toBe(2);
  expect(data.getBigUint64(4, true)).toBe(1000000001n);
  for (const amount of ["0", "1e-9", "-1", "1.0000000001", "+1", "01", "9007199.254740992"])
    expect(() => accountTipLamports(amount)).toThrow();
  expect(() =>
    buildAccountSolTipMessage({
      network: "devnet",
      sender: address(1),
      recipient: address(1),
      reference: address(3),
      blockhash: address(4),
      lamports: 1n,
    }),
  ).toThrow();
});
it("resolves stored wallets and reserves exact fee-inclusive amounts from trusted RPC snapshots", async () => {
  const result = await prepareAccountTip(input);
  expect(result).toMatchObject({ state: "reserved", reused: false });
  expect(accountWalletForTelegram).toHaveBeenNthCalledWith(1, 123, false);
  expect(accountWalletForTelegram).toHaveBeenNthCalledWith(2, 456, false);
  expect(rpc.mock.calls[1]?.[1].p_record).toMatchObject({
    requestKey: "tg:-100123:77:123",
    lamports: "1000000001",
    feeLamports: "5000",
    observedBalance: "1000010000",
    observedSlot: "101",
  });
  expect(readDevnetAccount).toHaveBeenLastCalledWith("getBalance", [
    address(1),
    { commitment: "finalized", minContextSlot: 100 },
  ]);
});
it("reuses the same server message without a second quote/reservation, rejects changed recipient", async () => {
  const existing = {
    id: "00000000-0000-4000-8000-000000000001",
    network: "devnet",
    state: "reserved",
    sender_user_id: 123,
    recipient_user_id: 456,
    telegram_chat_id: -100123,
    lamports: "1000000001",
    signed_bytes: "never returned",
  };
  rpc.mockResolvedValue({ data: existing });
  expect(await prepareAccountTip(input)).toEqual({
    id: existing.id,
    state: "reserved",
    reused: true,
  });
  expect(readDevnetAccount).not.toHaveBeenCalled();
  expect(accountWalletForTelegram).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: { ...existing, recipient_user_id: 789 } });
  await expect(prepareAccountTip(input)).rejects.toThrow("conflict");
});
it("rejects pause, banned/forgotten/cross-group/missing members before provider or storage access", async () => {
  for (const changed of [{ ...group, is_paused: true }, { ...group, removed_at: "now" }, null]) {
    groupData = changed;
    await expect(prepareAccountTip(input)).rejects.toThrow();
  }
  groupData = group;
  for (const changed of [
    [members[0]],
    [members[0], { ...members[1], is_banned: true }],
    [members[0], { ...members[1], pseudonym: "forgotten" }],
    [members[0], { ...members[1], group_id: "g2" }],
  ]) {
    memberData = changed;
    await expect(prepareAccountTip(input)).rejects.toThrow();
  }
  expect(readDevnetAccount).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("rejects null fee, stale balance and insufficient fee-inclusive funds without reserving", async () => {
  for (const [fee, balanceSlot, balance] of [
    [null, 100, 1000010000],
    [5000, 99, 1000010000],
    [5000, 100, 1000000001],
  ]) {
    vi.mocked(readDevnetAccount)
      .mockReset()
      .mockResolvedValueOnce({
        context: { slot: 100 },
        value: { blockhash: address(4), lastValidBlockHeight: 200 },
      })
      .mockResolvedValueOnce({ context: { slot: 100 }, value: fee })
      .mockResolvedValueOnce({ context: { slot: balanceSlot }, value: balance });
    await expect(prepareAccountTip(input)).rejects.toThrow();
  }
  expect(rpc.mock.calls.every((call) => call[0] === "bruh_account_tip_find_request")).toBe(true);
});
it("rejects disabled/mainnet/self-tip/invalid identity before all I/O", async () => {
  vi.stubEnv("SOLANA_NETWORK", "mainnet-beta");
  await expect(prepareAccountTip(input)).rejects.toThrow();
  vi.stubEnv("SOLANA_NETWORK", "devnet");
  vi.stubEnv("BRUH_ACCOUNT_TIPS_DEVNET_ENABLED", "false");
  await expect(prepareAccountTip(input)).rejects.toThrow();
  vi.stubEnv("BRUH_ACCOUNT_TIPS_DEVNET_ENABLED", "true");
  await expect(prepareAccountTip({ ...input, recipientUserId: 123 })).rejects.toThrow();
  await expect(prepareAccountTip({ ...input, senderUserId: 0 })).rejects.toThrow();
  expect(admin).not.toHaveBeenCalled();
  expect(readDevnetAccount).not.toHaveBeenCalled();
});
