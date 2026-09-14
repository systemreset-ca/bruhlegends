import { describe, expect, it, vi } from "vitest";
import {
  submitCustodyTransfer,
  reconcileCustodyTransfer,
  type CustodySignedTransfer,
} from "../src/lib/custody-submission.server";
const record: CustodySignedTransfer = {
  reservationId: "reservation",
  network: "devnet",
  signature: "2".repeat(88),
  wireBase64: Buffer.alloc(150, 1).toString("base64"),
  lastValidBlockHeight: 100,
};
function adapters() {
  return {
    store: {
      loadSigned: vi.fn().mockResolvedValue(null),
      persistSigned: vi.fn().mockResolvedValue(record),
      settleConfirmed: vi.fn(),
      releaseDefinitiveFailure: vi.fn(),
    },
    signer: { prepareAuthorizedTransfer: vi.fn().mockResolvedValue(record) },
    chain: {
      assertDevnetGenesis: vi.fn(),
      broadcastIdentical: vi.fn().mockResolvedValue(record.signature),
      inspectFinalized: vi.fn().mockResolvedValue({ state: "pending" }),
    },
  };
}
describe("custody durable submission/recovery", () => {
  it("commits signed bytes before broadcast and never counts broadcast as confirmation", async () => {
    const deps = adapters();
    deps.chain.broadcastIdentical.mockImplementation(async () => {
      expect(deps.store.persistSigned).toHaveBeenCalledOnce();
      return record.signature;
    });
    expect(await submitCustodyTransfer("reservation", deps)).toEqual({
      state: "submitted",
      signature: record.signature,
    });
    expect(deps.store.settleConfirmed).not.toHaveBeenCalled();
  });
  it("persistence failure cannot broadcast", async () => {
    const deps = adapters();
    deps.store.persistSigned.mockRejectedValue(new Error("store failed"));
    await expect(submitCustodyTransfer("reservation", deps)).rejects.toThrow("store failed");
    expect(deps.chain.broadcastIdentical).not.toHaveBeenCalled();
  });
  it("ambiguous broadcast retries original bytes without another signature or release", async () => {
    const deps = adapters();
    deps.store.loadSigned.mockResolvedValue(record);
    deps.chain.broadcastIdentical.mockRejectedValue(
      new Error("secret-bearing provider diagnostic"),
    );
    expect((await submitCustodyTransfer("reservation", deps)).state).toBe("pending_reconciliation");
    expect(deps.signer.prepareAuthorizedTransfer).not.toHaveBeenCalled();
    expect(deps.store.releaseDefinitiveFailure).not.toHaveBeenCalled();
    expect(deps.chain.broadcastIdentical).toHaveBeenCalledWith(record);
  });
  it("wrong genesis cannot sign, broadcast or reconcile", async () => {
    const deps = adapters();
    deps.chain.assertDevnetGenesis.mockRejectedValue(new Error("wrong genesis"));
    await expect(submitCustodyTransfer("reservation", deps)).rejects.toThrow("genesis");
    await expect(reconcileCustodyTransfer("reservation", deps)).rejects.toThrow("genesis");
    expect(deps.signer.prepareAuthorizedTransfer).not.toHaveBeenCalled();
    expect(deps.chain.inspectFinalized).not.toHaveBeenCalled();
  });
  it("requires finalized exact transfer proof before settlement; mismatches hold funds", async () => {
    const deps = adapters();
    deps.store.loadSigned.mockResolvedValue(record);
    deps.chain.inspectFinalized.mockResolvedValue({ state: "mismatch" });
    expect(await reconcileCustodyTransfer("reservation", deps)).toBe("manual_review");
    expect(deps.store.settleConfirmed).not.toHaveBeenCalled();
    expect(deps.store.releaseDefinitiveFailure).not.toHaveBeenCalled();
    deps.chain.inspectFinalized.mockResolvedValue({ state: "confirmed_exact_transfer" });
    expect(await reconcileCustodyTransfer("reservation", deps)).toBe("confirmed");
  });
  it.each([
    { finalizedBlockHeight: 100, historyComplete: true },
    { finalizedBlockHeight: 101, historyComplete: false },
  ])(
    "does not release an unseen transaction without complete finalized expiry evidence %o",
    async (status) => {
      const deps = adapters();
      deps.store.loadSigned.mockResolvedValue(record);
      deps.chain.inspectFinalized.mockResolvedValue({ state: "not_found", ...status });
      expect(await reconcileCustodyTransfer("reservation", deps)).toBe("pending");
      expect(deps.store.releaseDefinitiveFailure).not.toHaveBeenCalled();
    },
  );
  it("releases only definitively expired unseen transactions", async () => {
    const deps = adapters();
    deps.store.loadSigned.mockResolvedValue(record);
    deps.chain.inspectFinalized.mockResolvedValue({
      state: "not_found",
      finalizedBlockHeight: 101,
      historyComplete: true,
    });
    expect(await reconcileCustodyTransfer("reservation", deps)).toBe("expired");
    expect(deps.store.releaseDefinitiveFailure).toHaveBeenCalledWith(record, "expired_unseen");
  });
  it("rejects substituted persistent bytes before broadcasting", async () => {
    const deps = adapters();
    deps.store.persistSigned.mockResolvedValue({ ...record, signature: "3".repeat(88) });
    await expect(submitCustodyTransfer("reservation", deps)).rejects.toThrow("conflict");
    expect(deps.chain.broadcastIdentical).not.toHaveBeenCalled();
  });
});
