import { beforeEach, afterEach, expect, it, vi } from "vitest";
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519.js";
vi.mock("../src/lib/db.server", () => ({ admin: vi.fn() }));
vi.mock("../src/lib/account-wallet-balance.server", () => ({
  readDevnetAccount: vi.fn(),
  writeDevnetAccount: vi.fn(),
}));
vi.mock("../src/lib/account-tip-settlement.server", () => ({ reconcileAccountTip: vi.fn() }));
import { admin } from "../src/lib/db.server";
import { readDevnetAccount, writeDevnetAccount } from "../src/lib/account-wallet-balance.server";
import {
  generateAccountWallet,
  importAccountWrappingKey,
  signAccountWalletSolTip,
  type AccountWalletEnvelope,
} from "../src/lib/account-wallet-vault.server";
import {
  executeAuthorizedAccountTip,
  validatePersistedAccountTip,
} from "../src/lib/account-tip-execution.server";
const addr = (n: number) => bs58.encode(new Uint8Array(32).fill(n));
const id = "00000000-0000-4000-8000-000000000001";
const token = "a".repeat(32);
const rpc = vi.fn();
let wallet: AccountWalletEnvelope;
let record: Record<string, unknown>;
let saved: { signature: string; signed_transaction: string };
let events: string[];
beforeEach(async () => {
  vi.resetAllMocks();
  events = [];
  for (const [name, value] of Object.entries({
    SOLANA_NETWORK: "devnet",
    BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED: "true",
    BRUH_ACCOUNT_TIPS_DEVNET_ENABLED: "true",
    BRUH_ACCOUNT_SIGNING_DEVNET_ENABLED: "true",
    BRUH_ACCOUNT_WALLET_KEY_VERSION: "test-v1",
    BRUH_ACCOUNT_WALLET_WRAPPING_KEY: "12".repeat(32),
  }))
    vi.stubEnv(name, value);
  wallet = await generateAccountWallet(
    "123",
    "test-v1",
    await importAccountWrappingKey("12".repeat(32)),
  );
  record = {
    id,
    intent_id: id,
    sender_user_id: 123,
    recipient_user_id: 456,
    sender_wallet_id: wallet.id,
    sender_address: wallet.address,
    recipient_address: addr(2),
    reference: addr(3),
    network: "devnet",
    state: "reserved",
    lamports: "100000",
    fee_lamports: "5000",
    observed_slot: "100",
    expires_at: new Date(Date.now() + 180000).toISOString(),
  };
  vi.mocked(admin).mockResolvedValue({ rpc, from: vi.fn() });
  rpc.mockImplementation(async (name, args) => {
    events.push(name);
    if (name === "bruh_account_tip_authorized_read") return { data: record };
    if (name === "bruh_account_wallet_read") return { data: wallet };
    if (name === "bruh_account_tip_authorized_signed") {
      saved = { signature: args.p_signature, signed_transaction: args.p_transaction };
      return { data: { ...record, ...saved, state: "signed" } };
    }
    throw new Error("unexpected RPC");
  });
  vi.mocked(readDevnetAccount)
    .mockResolvedValueOnce({
      context: { slot: 101 },
      value: { blockhash: addr(4), lastValidBlockHeight: 200 },
    })
    .mockResolvedValueOnce({ context: { slot: 101 }, value: 5000 })
    .mockResolvedValueOnce({ context: { slot: 101 }, value: 1000000 });
  vi.mocked(writeDevnetAccount).mockImplementation(async (method) => {
    events.push(method);
    return method === "sendTransaction" ? saved.signature : { value: { err: null } };
  });
});
afterEach(() => vi.unstubAllEnvs());
it("signs only the stored intent and persists/consumes authorization before the first broadcast", async () => {
  const result = await executeAuthorizedAccountTip(id, 123, token);
  expect(result).toMatchObject({ state: "submitted", signature: saved.signature });
  expect(events).toEqual([
    "bruh_account_tip_authorized_read",
    "simulateTransaction",
    "bruh_account_wallet_read",
    "simulateTransaction",
    "bruh_account_tip_authorized_signed",
    "sendTransaction",
  ]);
  const persisted = { ...record, ...saved };
  expect(validatePersistedAccountTip(persisted)).toEqual({
    signature: saved.signature,
    signedTransaction: saved.signed_transaction,
  });
  const bytes = Uint8Array.from(atob(saved.signed_transaction), (c) => c.charCodeAt(0));
  expect(ed25519.verify(bytes.slice(1, 65), bytes.slice(65), bs58.decode(wallet.address))).toBe(
    true,
  );
  expect(JSON.stringify(result)).not.toContain("signed_transaction");
  expect(vi.mocked(writeDevnetAccount).mock.calls.at(-1)).toEqual([
    "sendTransaction",
    [
      saved.signed_transaction,
      { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 0 },
    ],
  ]);
});
it("refuses missing grants, wrong owners and changed wallet scope before signing/sending", async () => {
  rpc.mockResolvedValue({ data: null });
  await expect(executeAuthorizedAccountTip(id, 123, token)).rejects.toThrow();
  rpc.mockResolvedValue({ data: { ...record, sender_user_id: 456 } });
  await expect(executeAuthorizedAccountTip(id, 123, token)).rejects.toThrow();
  expect(writeDevnetAccount).not.toHaveBeenCalled();
  await expect(
    signAccountWalletSolTip(wallet, await importAccountWrappingKey("12".repeat(32)), {
      network: "devnet",
      sender: addr(9),
      recipient: addr(2),
      reference: addr(3),
      blockhash: addr(4),
      lamports: 1n,
    }),
  ).rejects.toThrow();
});
it("never broadcasts when simulation or atomic persistence fails", async () => {
  vi.mocked(writeDevnetAccount).mockResolvedValue({ value: { err: { failure: true } } });
  await expect(executeAuthorizedAccountTip(id, 123, token)).rejects.toThrow("simulation");
  expect(events).not.toContain("bruh_account_wallet_read");
  vi.mocked(writeDevnetAccount).mockResolvedValue({ value: { err: null } });
  vi.mocked(readDevnetAccount)
    .mockReset()
    .mockResolvedValueOnce({
      context: { slot: 101 },
      value: { blockhash: addr(4), lastValidBlockHeight: 200 },
    })
    .mockResolvedValueOnce({ context: { slot: 101 }, value: 5000 })
    .mockResolvedValueOnce({ context: { slot: 101 }, value: 1000000 });
  const original = rpc.getMockImplementation()!;
  rpc.mockImplementation(async (name, args) =>
    name === "bruh_account_tip_authorized_signed"
      ? { error: { message: "rejected" } }
      : original(name, args),
  );
  await expect(executeAuthorizedAccountTip(id, 123, token)).rejects.toThrow("persistence");
  expect(
    vi.mocked(writeDevnetAccount).mock.calls.some((call) => call[0] === "sendTransaction"),
  ).toBe(false);
});
it("keeps an uncertain submission signed rather than creating or cancelling another payment", async () => {
  vi.mocked(writeDevnetAccount).mockImplementation(async (method) => {
    if (method === "sendTransaction") throw new Error("timeout");
    return { value: { err: null } };
  });
  expect(await executeAuthorizedAccountTip(id, 123, token)).toEqual({
    state: "signed",
    signature: saved.signature,
    submissionUnknown: true,
  });
  expect(
    rpc.mock.calls.filter((call) => call[0] === "bruh_account_tip_authorized_signed").length,
  ).toBe(1);
});
it("rejects modified persisted signatures/recipient/amount/reference before any recovery action", async () => {
  await executeAuthorizedAccountTip(id, 123, token);
  const persisted = { ...record, ...saved };
  for (const changed of [
    { recipient_address: addr(8) },
    { reference: addr(8) },
    { lamports: "100001" },
    { signature: bs58.encode(new Uint8Array(64).fill(5)) },
    { signed_transaction: saved.signed_transaction.slice(0, -1) },
  ])
    expect(() => validatePersistedAccountTip({ ...persisted, ...changed })).toThrow();
});
it("rejects changed fee, stale slots, disabled signing and mainnet", async () => {
  vi.mocked(readDevnetAccount)
    .mockReset()
    .mockResolvedValueOnce({
      context: { slot: 101 },
      value: { blockhash: addr(4), lastValidBlockHeight: 200 },
    })
    .mockResolvedValueOnce({ context: { slot: 101 }, value: 5001 });
  await expect(executeAuthorizedAccountTip(id, 123, token)).rejects.toThrow("fee changed");
  expect(writeDevnetAccount).not.toHaveBeenCalled();
  vi.stubEnv("BRUH_ACCOUNT_SIGNING_DEVNET_ENABLED", "false");
  await expect(executeAuthorizedAccountTip(id, 123, token)).rejects.toThrow();
  vi.stubEnv("BRUH_ACCOUNT_SIGNING_DEVNET_ENABLED", "true");
  vi.stubEnv("SOLANA_NETWORK", "mainnet-beta");
  await expect(executeAuthorizedAccountTip(id, 123, token)).rejects.toThrow();
});

it("recovers only the identical persisted bytes and rejects unavailable persisted-message fees", async () => {
  const signed = await signAccountWalletSolTip(
    wallet,
    await importAccountWrappingKey("12".repeat(32)),
    {
      network: "devnet",
      sender: wallet.address,
      recipient: addr(2),
      reference: addr(3),
      blockhash: addr(4),
      lamports: 100000n,
    },
  );
  record = {
    ...record,
    state: "signed",
    signature: signed.signature,
    signed_transaction: signed.signedTransaction,
    last_valid_block_height: "200",
  };
  const { reconcileAccountTip } = await import("../src/lib/account-tip-settlement.server");
  vi.mocked(reconcileAccountTip).mockResolvedValue({ settled: false });
  vi.mocked(readDevnetAccount)
    .mockReset()
    .mockResolvedValue({ context: { slot: 101 }, value: 5000 });
  await executeAuthorizedAccountTip(id, 123, token);
  expect(writeDevnetAccount).toHaveBeenLastCalledWith("sendTransaction", [
    signed.signedTransaction,
    expect.any(Object),
  ]);
  expect(rpc).not.toHaveBeenCalledWith("bruh_account_wallet_read", expect.anything());
  vi.mocked(writeDevnetAccount).mockClear();
  vi.mocked(readDevnetAccount).mockResolvedValue({ context: { slot: 101 }, value: null });
  await expect(executeAuthorizedAccountTip(id, 123, token)).rejects.toThrow("Reservation retained");
  expect(writeDevnetAccount).not.toHaveBeenCalled();
});
