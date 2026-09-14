import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Connection,
  Keypair,
  SystemProgram,
  VersionedTransaction,
} from "../services/custody-signer/sol-transfer";
import { ed25519 } from "@noble/curves/ed25519.js";
import bs58 from "bs58";
import { DevnetCustodyVault } from "../src/lib/custody-vault.server";
import {
  buildSolTransfer,
  DEVNET_GENESIS,
  DevnetSolRpc,
  type SolTransferApproval,
} from "../services/custody-signer/sol-transfer";
const scope = {
  walletId: "00000000-0000-4000-8000-000000000001",
  groupId: "00000000-0000-4000-8000-000000000002",
  membershipId: "00000000-0000-4000-8000-000000000003",
  network: "devnet" as const,
};
async function fixture() {
  const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
  const vault = new DevnetCustodyVault(key as CryptoKey, "test-v1");
  const envelope = await vault.provision(scope);
  const approval: SolTransferApproval = {
    ...scope,
    reservationId: "00000000-0000-4000-8000-000000000004",
    network: "devnet",
    sender: envelope.address,
    recipient: Keypair.generate().publicKey.toBase58(),
    reference: Keypair.generate().publicKey.toBase58(),
    lamports: "123456789",
    feeCapLamports: "10000",
    blockhash: Keypair.generate().publicKey.toBase58(),
    lastValidBlockHeight: 100,
  };
  return { vault, envelope, approval };
}
afterEach(() => vi.restoreAllMocks());
describe("real SDK encrypted-wallet SOL signing", () => {
  it("reports exact finalized transfer proof and actual fee, and holds mismatched proof", async () => {
    const { vault, envelope, approval } = await fixture();
    const signed = await vault.signSolTransfer(envelope, scope, approval);
    const tx = VersionedTransaction.deserialize(Buffer.from(signed.wireBase64, "base64"));
    vi.spyOn(Connection.prototype, "getGenesisHash").mockResolvedValue(DEVNET_GENESIS);
    const lookup = vi.spyOn(Connection.prototype, "getTransaction").mockResolvedValue({
      slot: 101,
      transaction: { message: tx.message, signatures: [signed.signature] },
      meta: { err: null, fee: 5000 },
    } as never);
    const rpc = new DevnetSolRpc("https://example.invalid");
    expect(await rpc.inspect(signed, approval)).toEqual({
      state: "confirmed_exact_transfer",
      feeLamports: "5000",
      slot: 101,
    });
    lookup.mockResolvedValue({
      slot: 101,
      transaction: { message: tx.message, signatures: [signed.signature] },
      meta: { err: { InstructionError: [0, "InsufficientFunds"] }, fee: 5000 },
    } as never);
    expect(await rpc.inspect(signed, approval)).toEqual({
      state: "finalized_failed",
      feeLamports: "5000",
      slot: 101,
    });
    lookup.mockResolvedValue({
      slot: 101,
      transaction: {
        message: buildSolTransfer({ ...approval, lamports: "1" }).message,
        signatures: [signed.signature],
      },
      meta: { err: null, fee: 5000 },
    } as never);
    expect(await rpc.inspect(signed, approval)).toEqual({ state: "mismatch" });
    expect(lookup).toHaveBeenCalledWith(signed.signature, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
  });
  it("rejects a forged signature before broadcast", async () => {
    const { vault, envelope, approval } = await fixture();
    const signed = await vault.signSolTransfer(envelope, scope, approval);
    const tx = VersionedTransaction.deserialize(Buffer.from(signed.wireBase64, "base64"));
    tx.signatures[0]!.fill(0);
    vi.spyOn(Connection.prototype, "getGenesisHash").mockResolvedValue(DEVNET_GENESIS);
    const send = vi.spyOn(Connection.prototype, "sendRawTransaction");
    await expect(
      new DevnetSolRpc("https://example.invalid").broadcast(
        {
          ...signed,
          signature: bs58.encode(tx.signatures[0]!),
          wireBase64: Buffer.from(tx.serialize()).toString("base64"),
        },
        approval,
      ),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
  it("signs a verifiable, exact transfer with a read-only unique reference", async () => {
    const { vault, envelope, approval } = await fixture();
    const signed = await vault.signSolTransfer(envelope, scope, approval);
    const tx = VersionedTransaction.deserialize(Buffer.from(signed.wireBase64, "base64"));
    expect(
      ed25519.verify(
        bs58.decode(signed.signature),
        tx.message.serialize(),
        bs58.decode(envelope.address),
      ),
    ).toBe(true);
    expect(tx.message.compiledInstructions).toHaveLength(1);
    const instruction = tx.message.compiledInstructions[0]!;
    expect(
      tx.message.staticAccountKeys[instruction.programIdIndex]!.equals(SystemProgram.programId),
    ).toBe(true);
    expect(Buffer.from(instruction.data).readUInt32LE(0)).toBe(2);
    expect(Buffer.from(instruction.data).readBigUInt64LE(4)).toBe(123456789n);
    expect(tx.message.staticAccountKeys[instruction.accountKeyIndexes[1]!]!.toBase58()).toBe(
      approval.recipient,
    );
    const referenceIndex = instruction.accountKeyIndexes[2]!;
    expect(tx.message.staticAccountKeys[referenceIndex]!.toBase58()).toBe(approval.reference);
    expect(tx.message.isAccountWritable(referenceIndex)).toBe(false);
    expect(tx.message.isAccountSigner(referenceIndex)).toBe(false);
    expect(signed).toEqual(await vault.signSolTransfer(envelope, scope, approval));
  });
  it("rejects wrong group, sender and mainnet approvals", async () => {
    const { vault, envelope, approval } = await fixture();
    await expect(
      vault.signSolTransfer(envelope, { ...scope, groupId: approval.reservationId }, approval),
    ).rejects.toThrow();
    await expect(
      vault.signSolTransfer(envelope, scope, { ...approval, sender: approval.recipient }),
    ).rejects.toThrow();
    await expect(
      vault.signSolTransfer(envelope, scope, { ...approval, network: "mainnet-beta" as "devnet" }),
    ).rejects.toThrow();
  });
  it.each(["0", "-1", "1.5", "9000000000000001"])(
    "rejects invalid lamports %s",
    async (lamports) => {
      const { approval } = await fixture();
      expect(() => buildSolTransfer({ ...approval, lamports })).toThrow();
    },
  );
  it("checks RPC genesis before requesting a blockhash", async () => {
    const { approval } = await fixture();
    vi.spyOn(Connection.prototype, "getGenesisHash").mockResolvedValue("mainnet");
    const latest = vi.spyOn(Connection.prototype, "getLatestBlockhash");
    await expect(new DevnetSolRpc("https://example.invalid").prepare(approval)).rejects.toThrow(
      "devnet",
    );
    expect(latest).not.toHaveBeenCalled();
  });
  it("checks real SDK message fee estimate against the reservation", async () => {
    const { approval } = await fixture();
    vi.spyOn(Connection.prototype, "getGenesisHash").mockResolvedValue(DEVNET_GENESIS);
    vi.spyOn(Connection.prototype, "getLatestBlockhash").mockResolvedValue({
      blockhash: approval.blockhash,
      lastValidBlockHeight: 100,
    });
    const fee = vi
      .spyOn(Connection.prototype, "getFeeForMessage")
      .mockResolvedValue({ context: { slot: 1 }, value: 10001 });
    await expect(new DevnetSolRpc("https://example.invalid").prepare(approval)).rejects.toThrow(
      "fee",
    );
    fee.mockResolvedValue({ context: { slot: 1 }, value: 5000 });
    expect(await new DevnetSolRpc("https://example.invalid").prepare(approval)).toMatchObject({
      blockhash: approval.blockhash,
    });
  });
  it("broadcasts original signed bytes with preflight and rejects substituted approvals", async () => {
    const { vault, envelope, approval } = await fixture();
    const signed = await vault.signSolTransfer(envelope, scope, approval);
    vi.spyOn(Connection.prototype, "getGenesisHash").mockResolvedValue(DEVNET_GENESIS);
    const send = vi
      .spyOn(Connection.prototype, "sendRawTransaction")
      .mockResolvedValue(signed.signature);
    const rpc = new DevnetSolRpc("https://example.invalid");
    await expect(rpc.broadcast(signed, { ...approval, lamports: "1" })).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    expect(await rpc.broadcast(signed, approval)).toBe(signed.signature);
    expect(send).toHaveBeenCalledWith(
      Buffer.from(signed.wireBase64, "base64"),
      expect.objectContaining({ skipPreflight: false }),
    );
  });
  it("keeps missing finalized transactions pending", async () => {
    const { vault, envelope, approval } = await fixture();
    const signed = await vault.signSolTransfer(envelope, scope, approval);
    vi.spyOn(Connection.prototype, "getGenesisHash").mockResolvedValue(DEVNET_GENESIS);
    vi.spyOn(Connection.prototype, "getTransaction").mockResolvedValue(null);
    expect(await new DevnetSolRpc("https://example.invalid").inspect(signed, approval)).toEqual({
      state: "pending",
    });
  });
});
