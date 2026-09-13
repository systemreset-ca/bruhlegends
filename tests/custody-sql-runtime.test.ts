import { webcrypto, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { DevnetCustodyVault } from "../src/lib/custody-vault.server";
import {
  Keypair,
  DevnetSolRpc,
  type SolTransferApproval,
} from "../services/custody-signer/sol-transfer";
import {
  CustodySqlStore,
  submitReservedSolTip,
  reconcileStoredSolTip,
  type CustodyRuntime,
} from "../services/custody-signer/sql-runtime";
async function fixture() {
  const identity = {
    walletId: randomUUID(),
    groupId: randomUUID(),
    membershipId: randomUUID(),
    network: "devnet" as const,
  };
  const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
  const vault = new DevnetCustodyVault(key as CryptoKey, "test-v1");
  const envelope = await vault.provision(identity);
  const id = randomUUID();
  const transfer = {
    ...identity,
    reservationId: id,
    sender: envelope.address,
    recipient: Keypair.generate().publicKey.toBase58(),
    reference: Keypair.generate().publicKey.toBase58(),
    lamports: "100",
    feeCapLamports: "10000",
  };
  let approval: SolTransferApproval | null = null;
  let signed: unknown = null;
  const calls: string[] = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push(name);
    if (name === "get_devnet_custody_submission")
      return { data: approval ? { approval, signed } : null, error: null };
    if (name === "prepare_devnet_custody_submission") {
      approval ??= {
        ...transfer,
        blockhash: String(args.p_blockhash),
        lastValidBlockHeight: Number(args.p_height),
      };
      return { data: approval, error: null };
    }
    if (name === "persist_devnet_custody_signed") {
      signed ??= args.p_record;
      return { data: signed, error: null };
    }
    if (name === "settle_signed_devnet_custody") return { data: true, error: null };
    throw new Error("Unexpected RPC");
  });
  const sdk = new DevnetSolRpc("https://example.invalid");
  const chain: CustodyRuntime["chain"] = {
    assertDevnetGenesis: vi.fn(async () => {}),
    prepare: vi.fn(async () => ({
      ...transfer,
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 100,
    })),
    verifyFee: vi.fn(async () => {}),
    validateSigned: sdk.validateSigned.bind(sdk),
    broadcast: vi.fn(async (record) => {
      expect(signed).toEqual(record);
      calls.push("broadcast");
      return record.signature;
    }),
    inspect: vi.fn(async () => ({ state: "pending" as const })),
  };
  const runtime: CustodyRuntime = {
    vault,
    store: new CustodySqlStore(rpc),
    chain,
    authorize: vi.fn(async () => ({ identity, envelope, transfer })),
  };
  return { runtime, id, calls, rpc, transfer, getSigned: () => signed };
}
describe("SQL-backed encrypted signer orchestration", () => {
  it("stores approval then exact signed bytes before broadcast; retries do not sign again", async () => {
    const f = await fixture();
    const sign = vi.spyOn(f.runtime.vault, "signSolTransfer");
    const first = await submitReservedSolTip(f.id, f.runtime);
    expect(first.state).toBe("submitted");
    expect(f.calls.indexOf("prepare_devnet_custody_submission")).toBeLessThan(
      f.calls.indexOf("persist_devnet_custody_signed"),
    );
    expect(f.calls.indexOf("persist_devnet_custody_signed")).toBeLessThan(
      f.calls.indexOf("broadcast"),
    );
    expect(await submitReservedSolTip(f.id, f.runtime)).toEqual(first);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(f.calls).not.toContain("settle_signed_devnet_custody");
  });
  it("concurrent workers reuse the first blockhash and deterministic signed bytes", async () => {
    const f = await fixture();
    const results = await Promise.all([
      submitReservedSolTip(f.id, f.runtime),
      submitReservedSolTip(f.id, f.runtime),
    ]);
    expect(results[0]!.signature).toBe(results[1]!.signature);
  });
  it("failed persistence cannot broadcast", async () => {
    const f = await fixture();
    const original = f.rpc.getMockImplementation()!;
    f.rpc.mockImplementation(async (name, args) =>
      name === "persist_devnet_custody_signed"
        ? { data: null, error: new Error("sensitive diagnostic") }
        : original(name, args),
    );
    await expect(submitReservedSolTip(f.id, f.runtime)).rejects.toThrow("operation rejected");
    expect(f.runtime.chain.broadcast).not.toHaveBeenCalled();
  });
  it("ambiguous RPC keeps the stored transaction and pending funds", async () => {
    const f = await fixture();
    vi.mocked(f.runtime.chain.broadcast).mockRejectedValue(
      new Error("provider credential diagnostic"),
    );
    expect((await submitReservedSolTip(f.id, f.runtime)).state).toBe("pending_reconciliation");
    expect(f.getSigned()).not.toBeNull();
    expect(f.calls).not.toContain("settle_signed_devnet_custody");
  });
  it("rejects an unauthorized actor before reading/signing", async () => {
    const f = await fixture();
    vi.mocked(f.runtime.authorize).mockRejectedValue(new Error("Actor denied"));
    await expect(submitReservedSolTip(f.id, f.runtime)).rejects.toThrow("Actor denied");
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("settles exact finalized proof with actual fee and slot; pending/failures retain holds", async () => {
    const f = await fixture();
    await submitReservedSolTip(f.id, f.runtime);
    expect(await reconcileStoredSolTip(f.id, f.runtime)).toBe("pending");
    vi.mocked(f.runtime.chain.inspect).mockResolvedValue({
      state: "confirmed_exact_transfer",
      feeLamports: "5000",
      slot: 123,
    });
    expect(await reconcileStoredSolTip(f.id, f.runtime)).toBe("confirmed");
    expect(f.rpc).toHaveBeenCalledWith(
      "settle_signed_devnet_custody",
      expect.objectContaining({ p_fee: "5000", p_slot: 123 }),
    );
    vi.mocked(f.runtime.chain.inspect).mockResolvedValue({
      state: "finalized_failed",
      feeLamports: "5000",
      slot: 123,
    });
    expect(await reconcileStoredSolTip(f.id, f.runtime)).toBe("manual_review");
  });
});
