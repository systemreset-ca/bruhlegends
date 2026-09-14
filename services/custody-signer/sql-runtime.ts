import type {
  CustodyEnvelope,
  CustodyIdentity,
  DevnetCustodyVault,
} from "../../src/lib/custody-vault.server.ts";
import {
  buildSolTransfer,
  type DevnetSolRpc,
  type SolTransferApproval,
  type signSolTransfer,
} from "./sol-transfer.ts";
type Signed = ReturnType<typeof signSolTransfer>;
export type CustodyRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;
type Snapshot = { approval: SolTransferApproval; signed: Signed | null };
const fields = [
  "walletId",
  "groupId",
  "membershipId",
  "reservationId",
  "network",
  "sender",
  "recipient",
  "reference",
  "lamports",
  "feeCapLamports",
  "blockhash",
  "lastValidBlockHeight",
];
function parseApproval(value: unknown): SolTransferApproval {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.length ||
    !fields.every((key) => Object.hasOwn(value, key))
  )
    throw new Error("Invalid stored custody approval.");
  const approval = value as SolTransferApproval;
  buildSolTransfer(approval);
  return approval;
}
/** Supply a narrowly privileged, isolated server RPC client. No default keys,
 * generic table writes or raw provider diagnostics leave this adapter. */
export class CustodySqlStore {
  constructor(private readonly rpc: CustodyRpc) {}
  private async call(name: string, args: Record<string, unknown>) {
    const result = await this.rpc(name, args).catch(() => {
      throw new Error("Custody database unavailable.");
    });
    if (result.error) throw new Error("Custody database operation rejected.");
    return result.data;
  }
  async load(id: string): Promise<Snapshot | null> {
    const row = await this.call("get_devnet_custody_submission", { p_id: id });
    if (row === null) return null;
    if (
      !row ||
      typeof row !== "object" ||
      !Object.hasOwn(row, "approval") ||
      !Object.hasOwn(row, "signed")
    )
      throw new Error("Invalid custody snapshot.");
    const snapshot = row as Snapshot;
    const approval = parseApproval(snapshot.approval);
    if (approval.reservationId !== id) throw new Error("Custody reservation mismatch.");
    return { approval, signed: snapshot.signed };
  }
  async prepare(candidate: SolTransferApproval) {
    const approval = parseApproval(
      await this.call("prepare_devnet_custody_submission", {
        p_id: candidate.reservationId,
        p_blockhash: candidate.blockhash,
        p_height: candidate.lastValidBlockHeight,
        p_reference: candidate.reference,
      }),
    );
    for (const key of [
      "walletId",
      "groupId",
      "membershipId",
      "reservationId",
      "network",
      "sender",
      "recipient",
      "lamports",
      "feeCapLamports",
    ] as const) {
      if (approval[key] !== candidate[key])
        throw new Error("Stored custody approval differs from authorized reservation.");
    }
    return approval;
  }
  async persist(record: Signed) {
    const stored = await this.call("persist_devnet_custody_signed", {
      p_id: record.reservationId,
      p_record: record,
    });
    if (
      !stored ||
      typeof stored !== "object" ||
      Object.keys(stored).length !== 5 ||
      (Object.keys(record) as (keyof Signed)[]).some(
        (key) => (stored as Signed)[key] !== record[key],
      )
    )
      throw new Error("Signed custody persistence conflict.");
    return stored as Signed;
  }
  async settle(record: Signed, proof: { feeLamports: string; slot: number }) {
    if (
      !/^(0|[1-9][0-9]*)$/.test(proof.feeLamports) ||
      !Number.isSafeInteger(proof.slot) ||
      proof.slot < 0
    )
      throw new Error("Invalid custody proof.");
    return this.call("settle_signed_devnet_custody", {
      p_id: record.reservationId,
      p_signature: record.signature,
      p_fee: proof.feeLamports,
      p_slot: proof.slot,
    });
  }
}
type AuthorizedReservation = {
  identity: CustodyIdentity;
  envelope: CustodyEnvelope;
  transfer: Omit<SolTransferApproval, "blockhash" | "lastValidBlockHeight">;
};
export type CustodyRuntime = {
  vault: DevnetCustodyVault;
  store: CustodySqlStore;
  chain: Pick<
    DevnetSolRpc,
    "assertDevnetGenesis" | "prepare" | "verifyFee" | "validateSigned" | "broadcast" | "inspect"
  >;
  /** Verify Telegram actor, ownership, approval freshness and spending limits;
   * retrieve server-owned reservation/envelope. Never trust client snapshots. */
  authorize(id: string): Promise<AuthorizedReservation>;
};
export async function submitReservedSolTip(id: string, runtime: CustodyRuntime) {
  await runtime.chain.assertDevnetGenesis();
  const authorized = await runtime.authorize(id);
  const transfer = authorized.transfer;
  if (
    transfer.reservationId !== id ||
    transfer.sender !== authorized.envelope.address ||
    Object.entries(authorized.identity).some(
      ([key, value]) => transfer[key as keyof CustodyIdentity] !== value,
    )
  )
    throw new Error("Custody authorization scope mismatch.");
  const existing = await runtime.store.load(id);
  let approval: SolTransferApproval;
  let signed: Signed;
  if (existing?.signed) {
    approval = existing.approval;
    for (const key of [
      "walletId",
      "groupId",
      "membershipId",
      "reservationId",
      "sender",
      "recipient",
      "lamports",
      "feeCapLamports",
    ] as const)
      if (approval[key] !== transfer[key])
        throw new Error("Stored transfer authorization mismatch.");
    signed = existing.signed;
  } else {
    const candidate = await runtime.chain.prepare(transfer);
    approval = await runtime.store.prepare(candidate);
    await runtime.chain.verifyFee(approval);
    signed = await runtime.vault.signSolTransfer(
      authorized.envelope,
      authorized.identity,
      approval,
    );
    runtime.chain.validateSigned(signed, approval);
    signed = await runtime.store.persist(signed);
  }
  runtime.chain.validateSigned(signed, approval);
  try {
    const signature = await runtime.chain.broadcast(signed, approval);
    return {
      state:
        signature === signed.signature
          ? ("submitted" as const)
          : ("pending_reconciliation" as const),
      signature: signed.signature,
    };
  } catch {
    return { state: "pending_reconciliation" as const, signature: signed.signature };
  }
}
export async function reconcileStoredSolTip(
  id: string,
  runtime: Pick<CustodyRuntime, "store" | "chain">,
) {
  const snapshot = await runtime.store.load(id);
  if (!snapshot?.signed) return "pending";
  const proof = await runtime.chain.inspect(snapshot.signed, snapshot.approval);
  if (proof.state === "confirmed_exact_transfer") {
    await runtime.store.settle(snapshot.signed, proof);
    return "confirmed";
  }
  // Failure fees and unseen expiry require a reviewed atomic release function.
  // Keep holds until that function exists; never release just because of a timer.
  return proof.state === "pending" ? "pending" : "manual_review";
}
