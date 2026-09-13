/** Explicit ephemeral devnet experiment. No mainnet/provider secrets/user funds.
 * Never imports/exports a seed or persists a wrapping key. One faucet request. */
import { webcrypto, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { DevnetCustodyVault } from "../../src/lib/custody-vault.server.ts";
import { Connection, PublicKey } from "@solana/web3.js";
import { DevnetSolRpc, DEVNET_GENESIS } from "./sol-transfer.ts";

const endpoint = "https://api.devnet.solana.com";
const scope = {
  walletId: randomUUID(),
  groupId: randomUUID(),
  membershipId: randomUUID(),
  network: "devnet" as const,
};
const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
  "encrypt",
  "decrypt",
]);
const vault = new DevnetCustodyVault(key as CryptoKey, "ephemeral-smoke-v1");
const sender = await vault.provision(scope);
const recipient = await vault.provision({
  ...scope,
  walletId: randomUUID(),
  membershipId: randomUUID(),
});
const reference = new PublicKey(webcrypto.getRandomValues(new Uint8Array(32))).toBase58();
const connection = new Connection(endpoint, {
  commitment: "finalized",
  disableRetryOnRateLimit: true,
});
try {
  if ((await connection.getGenesisHash()) !== DEVNET_GENESIS)
    throw new Error("Wrong devnet genesis.");
  const faucetSignature = await connection.requestAirdrop(
    new PublicKey(sender.address),
    10_000_000,
  );
  const validity = await connection.getLatestBlockhash("finalized");
  const faucet = await connection.confirmTransaction(
    { ...validity, signature: faucetSignature },
    "finalized",
  );
  if (faucet.value.err) throw new Error("Devnet faucet transaction failed.");
  const rpc = new DevnetSolRpc(endpoint);
  const approval = await rpc.prepare({
    ...scope,
    reservationId: randomUUID(),
    sender: sender.address,
    recipient: recipient.address,
    reference,
    lamports: "1000000",
    feeCapLamports: "10000",
  });
  const signed = await vault.signSolTransfer(sender, scope, approval);
  await mkdir("artifacts/devnet-wallet-smoke", { recursive: true });
  // Test-only immutable signed bytes, no encryption/private key material.
  await writeFile(
    `artifacts/devnet-wallet-smoke/${signed.reservationId}.json`,
    JSON.stringify({ approval, signed }, null, 2),
    { flag: "wx" },
  );
  const signature = await rpc.broadcast(signed, approval);
  if (signature !== signed.signature) throw new Error("RPC returned wrong signature.");
  const confirmation = await connection.confirmTransaction(
    {
      blockhash: approval.blockhash,
      lastValidBlockHeight: approval.lastValidBlockHeight,
      signature,
    },
    "finalized",
  );
  if (confirmation.value.err) throw new Error("Devnet transfer failed.");
  const proof = await rpc.inspect(signed, approval);
  const balance = await connection.getBalance(new PublicKey(recipient.address), "finalized");
  if (proof.state !== "confirmed_exact_transfer" || balance !== 1_000_000)
    throw new Error("Devnet receipt mismatch.");
  console.log(
    JSON.stringify({
      state: "verified_devnet_transfer",
      signature,
      lamports: "1000000",
      proof,
      recipientBalanceLamports: balance,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      state: "devnet_smoke_not_verified",
      reason: error instanceof Error ? error.message : "RPC failure",
    }),
  );
  process.exitCode = 1;
}
