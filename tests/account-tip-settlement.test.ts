import { afterEach, beforeEach, expect, it, vi } from "vitest";
import bs58 from "bs58";
vi.mock("../src/lib/db.server", () => ({ admin: vi.fn() }));
vi.mock("../src/lib/account-wallet-balance.server", () => ({
  verifyFinalizedAccountSolTip: vi.fn(),
}));
import { admin } from "../src/lib/db.server";
import { verifyFinalizedAccountSolTip } from "../src/lib/account-wallet-balance.server";
import { reconcileAccountTip } from "../src/lib/account-tip-settlement.server";
const id = "00000000-0000-4000-8000-000000000001";
const address = (n: number) => bs58.encode(new Uint8Array(32).fill(n));
const record = {
  id,
  intent_id: id,
  network: "devnet",
  sender_user_id: 123,
  state: "signed",
  lamports: "1000000",
  fee_lamports: "5000",
  sender_address: address(1),
  recipient_address: address(2),
  reference: address(3),
  signature: bs58.encode(new Uint8Array(64).fill(7)),
};
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SOLANA_NETWORK", "devnet");
  vi.stubEnv("BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED", "true");
  vi.stubEnv("BRUH_ACCOUNT_TIPS_DEVNET_ENABLED", "true");
  vi.mocked(admin).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof admin>>);
});
afterEach(() => vi.unstubAllEnvs());
it("uses frozen account-bound fields and exact fee proof before atomic settlement", async () => {
  rpc
    .mockResolvedValueOnce({ data: record })
    .mockResolvedValueOnce({ data: { allowed: true } })
    .mockResolvedValueOnce({ data: { ...record, state: "finalized", credited: true } });
  vi.mocked(verifyFinalizedAccountSolTip).mockResolvedValue({ matched: true, slot: 101 });
  expect(await reconcileAccountTip(id, 123)).toEqual({
    settled: true,
    signature: record.signature,
    slot: 101,
  });
  expect(verifyFinalizedAccountSolTip).toHaveBeenCalledWith({
    signature: record.signature,
    sender: address(1),
    recipient: address(2),
    reference: address(3),
    lamports: 1000000n,
    feeLamports: 5000n,
  });
  expect(rpc.mock.calls[2]).toEqual([
    "bruh_account_tip_finalize_credit",
    { p_id: id, p_user_id: 123, p_signature: record.signature, p_slot: 101, p_fee: "5000" },
  ]);
});
it("keeps missing or unmatched receipts reserved", async () => {
  rpc.mockResolvedValueOnce({ data: record }).mockResolvedValueOnce({ data: { allowed: true } });
  vi.mocked(verifyFinalizedAccountSolTip).mockResolvedValue({ matched: false });
  expect(await reconcileAccountTip(id, 123)).toEqual({ settled: false });
  expect(rpc).toHaveBeenCalledTimes(2);
});
it("rejects wrong identity, unsafe amounts, disabled gate and mainnet without settlement", async () => {
  for (const changed of [
    { sender_user_id: 456 },
    { network: "mainnet-beta" },
    { state: "reserved" },
    { lamports: 9007199254740992 },
    { fee_lamports: "-1" },
  ]) {
    rpc.mockResolvedValue({ data: { ...record, ...changed } });
    await expect(reconcileAccountTip(id, 123)).rejects.toThrow();
  }
  expect(verifyFinalizedAccountSolTip).not.toHaveBeenCalled();
  rpc.mockClear();
  vi.stubEnv("BRUH_ACCOUNT_TIPS_DEVNET_ENABLED", "false");
  await expect(reconcileAccountTip(id, 123)).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});

it("does not report a tip settled when its history credit fails", async () => {
  rpc
    .mockResolvedValueOnce({ data: record })
    .mockResolvedValueOnce({ data: { allowed: true } })
    .mockResolvedValueOnce({ data: { ...record, state: "finalized", credited: false } });
  vi.mocked(verifyFinalizedAccountSolTip).mockResolvedValue({ matched: true, slot: 101 });
  await expect(reconcileAccountTip(id, 123)).rejects.toThrow("settlement unavailable");
});

it("avoids provider calls when checks are throttled or immutable credit already exists", async () => {
  rpc.mockResolvedValueOnce({ data: record }).mockResolvedValueOnce({ data: { allowed: false } });
  expect(await reconcileAccountTip(id, 123)).toEqual({ settled: false });
  expect(verifyFinalizedAccountSolTip).not.toHaveBeenCalled();
  rpc
    .mockResolvedValueOnce({ data: record })
    .mockResolvedValueOnce({ data: { credited: true, signature: record.signature, slot: 101 } });
  expect(await reconcileAccountTip(id, 123)).toEqual({
    settled: true,
    signature: record.signature,
    slot: 101,
  });
  expect(verifyFinalizedAccountSolTip).not.toHaveBeenCalled();
});
