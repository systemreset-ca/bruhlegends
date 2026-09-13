import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519.js";
export { Connection, Keypair, SystemProgram, VersionedTransaction } from "@solana/web3.js";

export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export type SolTransferApproval = {
  walletId: string;
  groupId: string;
  membershipId: string;
  reservationId: string;
  network: "devnet";
  sender: string;
  recipient: string;
  reference: string;
  lamports: string;
  feeCapLamports: string;
  blockhash: string;
  lastValidBlockHeight: number;
};
export function buildSolTransfer(approval: SolTransferApproval) {
  if (
    approval.network !== "devnet" ||
    ![approval.reservationId, approval.walletId, approval.groupId, approval.membershipId].every(
      (value) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
    ) ||
    !/^[1-9][0-9]{0,15}$/.test(approval.lamports) ||
    !/^(0|[1-9][0-9]{0,6})$/.test(approval.feeCapLamports) ||
    BigInt(approval.lamports) + BigInt(approval.feeCapLamports) > 9_000_000_000_000_000n ||
    BigInt(approval.feeCapLamports) > 1_000_000n ||
    !Number.isSafeInteger(approval.lastValidBlockHeight) ||
    approval.lastValidBlockHeight < 0
  ) {
    throw new Error("Invalid devnet SOL approval.");
  }
  const sender = new PublicKey(approval.sender);
  const recipient = new PublicKey(approval.recipient);
  const reference = new PublicKey(approval.reference);
  new PublicKey(approval.blockhash);
  if (
    [recipient, reference, SystemProgram.programId].some((k) => k.equals(sender)) ||
    reference.equals(recipient) ||
    reference.equals(SystemProgram.programId)
  ) {
    throw new Error("Invalid SOL transfer destination/reference.");
  }
  const instruction = SystemProgram.transfer({
    fromPubkey: sender,
    toPubkey: recipient,
    lamports: BigInt(approval.lamports),
  });
  instruction.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
  return new VersionedTransaction(
    new TransactionMessage({
      payerKey: sender,
      recentBlockhash: approval.blockhash,
      instructions: [instruction],
    }).compileToV0Message(),
  );
}

/** Called only inside the encrypted vault; never exposed as a public signer. */
export function signSolTransfer(seed: Uint8Array, approval: SolTransferApproval) {
  const transaction = buildSolTransfer(approval);
  const keypair = Keypair.fromSeed(seed);
  try {
    if (keypair.publicKey.toBase58() !== approval.sender) throw new Error("Wrong wallet signer.");
    transaction.sign([keypair]);
    return {
      reservationId: approval.reservationId,
      network: "devnet" as const,
      signature: bs58.encode(transaction.signatures[0]!),
      wireBase64: Buffer.from(transaction.serialize()).toString("base64"),
      lastValidBlockHeight: approval.lastValidBlockHeight,
    };
  } finally {
    keypair.secretKey.fill(0);
  }
}

/** Real SDK/RPC adapter. Authorization, claim and durable store are separate.
 * Missing history never proves that a transaction can no longer land. */
export class DevnetSolRpc {
  private readonly connection: Connection;
  constructor(endpoint: string) {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("An explicit HTTPS RPC endpoint is required.");
    this.connection = new Connection(endpoint, {
      commitment: "finalized",
      disableRetryOnRateLimit: true,
    });
  }
  async assertDevnetGenesis() {
    if ((await this.connection.getGenesisHash()) !== DEVNET_GENESIS) {
      throw new Error("Custody signer requires devnet.");
    }
  }
  async prepare(approval: Omit<SolTransferApproval, "blockhash" | "lastValidBlockHeight">) {
    await this.assertDevnetGenesis();
    const recent = await this.connection.getLatestBlockhash("finalized");
    const snapshot = { ...approval, ...recent };
    const transaction = buildSolTransfer(snapshot);
    const fee = await this.connection.getFeeForMessage(transaction.message, "finalized");
    if (
      fee.value === null ||
      !Number.isSafeInteger(fee.value) ||
      fee.value < 0 ||
      BigInt(fee.value) > BigInt(snapshot.feeCapLamports)
    ) {
      throw new Error("SOL network fee unavailable or exceeds reserved cap.");
    }
    return snapshot;
  }
  async broadcast(record: ReturnType<typeof signSolTransfer>, approval: SolTransferApproval) {
    await this.assertDevnetGenesis();
    this.validateSigned(record, approval);
    return this.connection.sendRawTransaction(Buffer.from(record.wireBase64, "base64"), {
      skipPreflight: false,
      preflightCommitment: "finalized",
      maxRetries: 2,
    });
  }
  private validateSigned(
    record: ReturnType<typeof signSolTransfer>,
    approval: SolTransferApproval,
  ) {
    const transaction = VersionedTransaction.deserialize(Buffer.from(record.wireBase64, "base64"));
    const expected = buildSolTransfer(approval);
    if (
      record.network !== "devnet" ||
      record.reservationId !== approval.reservationId ||
      record.lastValidBlockHeight !== approval.lastValidBlockHeight ||
      transaction.signatures.length !== 1 ||
      record.signature !== bs58.encode(transaction.signatures[0]!) ||
      !ed25519.verify(
        transaction.signatures[0]!,
        transaction.message.serialize(),
        new PublicKey(approval.sender).toBytes(),
      ) ||
      !Buffer.from(transaction.message.serialize()).equals(
        Buffer.from(expected.message.serialize()),
      )
    ) {
      throw new Error("Signed transfer differs from reservation.");
    }
    return transaction;
  }
  async inspect(record: ReturnType<typeof signSolTransfer>, approval: SolTransferApproval) {
    await this.assertDevnetGenesis();
    const expected = this.validateSigned(record, approval);
    const transaction = await this.connection.getTransaction(record.signature, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction || !transaction.meta) return { state: "pending" as const };
    if (
      !Buffer.from(transaction.transaction.message.serialize()).equals(
        Buffer.from(expected.message.serialize()),
      ) ||
      transaction.transaction.signatures[0] !== record.signature ||
      !Number.isSafeInteger(transaction.meta.fee) ||
      transaction.meta.fee < 0 ||
      BigInt(transaction.meta.fee) > BigInt(approval.feeCapLamports)
    ) {
      return { state: "mismatch" as const };
    }
    return {
      state: transaction.meta.err
        ? ("finalized_failed" as const)
        : ("confirmed_exact_transfer" as const),
      feeLamports: String(transaction.meta.fee),
      slot: transaction.slot,
    };
  }
}
