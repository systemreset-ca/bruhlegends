/** Durable-first submission protocol. Adapters must implement the protected
 * signer, exact transaction verification and atomic store; no live defaults.
 * A timeout is ambiguous and NEVER permits signing a replacement transaction.
 */
export type CustodySignedTransfer = {
  reservationId: string;
  network: "devnet";
  signature: string;
  wireBase64: string;
  lastValidBlockHeight: number;
};
export type CustodySubmissionDependencies = {
  store: {
    loadSigned(id: string): Promise<CustodySignedTransfer | null>;
    /** Immutable unique reservation insert; returns original on identical retry.
     * Conflicting candidate must fail closed. Commit before returning. */
    persistSigned(candidate: CustodySignedTransfer): Promise<CustodySignedTransfer>;
    settleConfirmed(record: CustodySignedTransfer): Promise<void>;
    releaseDefinitiveFailure(
      record: CustodySignedTransfer,
      reason: "chain_failed" | "expired_unseen",
    ): Promise<void>;
  };
  signer: {
    /** Claims reservation atomically; validates authenticated approval/group,
     * limits/expiry/network; constructs ONLY its snapshotted SOL transfer. */
    prepareAuthorizedTransfer(id: string): Promise<CustodySignedTransfer>;
  };
  chain: {
    assertDevnetGenesis(): Promise<void>;
    broadcastIdentical(record: CustodySignedTransfer): Promise<string>;
    inspectFinalized(
      record: CustodySignedTransfer,
    ): Promise<
      | { state: "confirmed_exact_transfer" }
      | { state: "finalized_failed" }
      | { state: "pending" }
      | { state: "not_found"; finalizedBlockHeight: number; historyComplete: boolean }
      | { state: "mismatch" }
    >;
  };
};
function validateRecord(record: CustodySignedTransfer, reservationId: string) {
  if (
    record.reservationId !== reservationId ||
    record.network !== "devnet" ||
    !Number.isSafeInteger(record.lastValidBlockHeight) ||
    record.lastValidBlockHeight < 0 ||
    !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(record.signature) ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(record.wireBase64) ||
    Buffer.from(record.wireBase64, "base64").length > 1232 ||
    Buffer.from(record.wireBase64, "base64").length < 100 ||
    Buffer.from(record.wireBase64, "base64").toString("base64") !== record.wireBase64
  ) {
    throw new Error("Invalid signed custody record.");
  }
}
export async function submitCustodyTransfer(
  reservationId: string,
  deps: CustodySubmissionDependencies,
): Promise<{ state: "submitted" | "pending_reconciliation"; signature: string }> {
  await deps.chain.assertDevnetGenesis();
  let record = await deps.store.loadSigned(reservationId);
  if (!record) {
    const prepared = await deps.signer.prepareAuthorizedTransfer(reservationId);
    validateRecord(prepared, reservationId);
    record = await deps.store.persistSigned(prepared);
    // A store that substitutes bytes invalidates authorization, even with the same ID.
    if (
      (Object.keys(prepared) as (keyof CustodySignedTransfer)[]).some(
        (key) => record![key] !== prepared[key],
      )
    ) {
      throw new Error("Signed custody persistence conflict.");
    }
  }
  validateRecord(record, reservationId);
  try {
    const signature = await deps.chain.broadcastIdentical(record);
    if (signature !== record.signature)
      return { state: "pending_reconciliation", signature: record.signature };
    return { state: "submitted", signature };
  } catch {
    // Provider diagnostics may contain secrets. Preserve the original signed
    // transaction and reserved funds; next retry broadcasts these exact bytes.
    return { state: "pending_reconciliation", signature: record.signature };
  }
}
export async function reconcileCustodyTransfer(
  reservationId: string,
  deps: CustodySubmissionDependencies,
): Promise<"confirmed" | "failed" | "expired" | "pending" | "manual_review"> {
  await deps.chain.assertDevnetGenesis();
  const record = await deps.store.loadSigned(reservationId);
  if (!record) return "pending";
  validateRecord(record, reservationId);
  const result = await deps.chain.inspectFinalized(record);
  if (result.state === "confirmed_exact_transfer") {
    await deps.store.settleConfirmed(record);
    return "confirmed";
  }
  if (result.state === "finalized_failed") {
    // Failed Solana transactions can still charge fees. Adapter MUST reconcile
    // actual fee before releasing unused principal/reserve, atomically/idempotently.
    await deps.store.releaseDefinitiveFailure(record, "chain_failed");
    return "failed";
  }
  if (result.state === "mismatch") return "manual_review";
  if (
    result.state === "not_found" &&
    result.historyComplete &&
    Number.isSafeInteger(result.finalizedBlockHeight) &&
    result.finalizedBlockHeight > record.lastValidBlockHeight
  ) {
    // Requires a history-complete provider and finalized expiry, not wall time.
    await deps.store.releaseDefinitiveFailure(record, "expired_unseen");
    return "expired";
  }
  return "pending";
}
