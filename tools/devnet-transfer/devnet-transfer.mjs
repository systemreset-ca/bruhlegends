/**
 * Bounded devnet two-wallet transfer exercise.
 *
 * - Creates two disposable keypairs in process memory only. Secret keys are
 *   never printed, logged or written to disk.
 * - Builds the RPC endpoint from BRUH_DEVNET_API_KEY (Helius devnet) or falls
 *   back to SOLANA_RPC_URL. The endpoint is never printed.
 * - Verifies the devnet genesis hash before doing anything else.
 * - Requests exactly ONE airdrop, bounded confirmation.
 * - On funding, sends 0.001 SOL A -> B with preflight enabled and verifies the
 *   finalized transaction's sender, recipient and amount.
 *
 * Run: node tools/devnet-transfer/devnet-transfer.mjs
 * Requires @solana/web3.js resolvable (installed out-of-tree for this
 * experiment; it is NOT an application dependency).
 */
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const TRANSFER_SOL = 0.001;
const AIRDROP_SOL = 1;

function endpoint() {
  const key = process.env.BRUH_DEVNET_API_KEY?.trim();
  if (key) return `https://devnet.helius-rpc.com/?api-key=${key}`;
  const url = process.env.SOLANA_RPC_URL?.trim();
  if (url) return url;
  throw new Error("No devnet RPC configuration present");
}

/** Provider errors can embed the API key; only a category is ever surfaced. */
function category(error) {
  const text = String(error?.message ?? error);
  if (/429|rate|too many/i.test(text)) return "rate_limited";
  if (/airdrop|faucet|limit/i.test(text)) return "faucet_refused";
  if (/timeout|abort|deadline/i.test(text)) return "timeout";
  if (/403|401|unauthor|forbidden/i.test(text)) return "provider_auth_rejected";
  if (/insufficient/i.test(text)) return "insufficient_funds";
  return "provider_error";
}

async function main() {
  const connection = new Connection(endpoint(), "confirmed");

  const genesis = await connection.getGenesisHash();
  if (genesis !== DEVNET_GENESIS) {
    console.log("STATUS: aborted — endpoint is not Solana devnet");
    process.exit(1);
  }
  console.log(`genesis: ${genesis} (devnet confirmed)`);

  const walletA = Keypair.generate();
  const walletB = Keypair.generate();
  console.log(`wallet A (sender):    ${walletA.publicKey.toBase58()}`);
  console.log(`wallet B (recipient): ${walletB.publicKey.toBase58()}`);

  let funded = false;
  try {
    const sig = await connection.requestAirdrop(walletA.publicKey, AIRDROP_SOL * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature: sig, ...latest },
      "confirmed",
    );
    funded = true;
    console.log(`airdrop: confirmed (${AIRDROP_SOL} SOL)`);
  } catch (error) {
    console.log(`airdrop: FAILED — cause category: ${category(error)}`);
  }

  const balanceA = await connection.getBalance(walletA.publicKey, "confirmed");
  console.log(`wallet A balance: ${balanceA / LAMPORTS_PER_SOL} SOL`);

  if (!funded && balanceA < TRANSFER_SOL * LAMPORTS_PER_SOL) {
    console.log("STATUS: NOT TRANSFERRED — sender unfunded.");
    console.log(`Fund this fresh devnet address to continue: ${walletA.publicKey.toBase58()}`);
    console.log("Process stays alive for 10 minutes so the keypair survives external funding.");
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 15_000));
      const current = await connection.getBalance(walletA.publicKey, "confirmed");
      if (current >= TRANSFER_SOL * LAMPORTS_PER_SOL + 10_000) {
        console.log(`external funding detected: ${current / LAMPORTS_PER_SOL} SOL`);
        return transfer(connection, walletA, walletB);
      }
    }
    console.log("STATUS: NOT TRANSFERRED — no funding arrived within the bound.");
    return;
  }

  return transfer(connection, walletA, walletB);
}

async function transfer(connection, walletA, walletB) {
  const lamports = TRANSFER_SOL * LAMPORTS_PER_SOL;
  const beforeB = await connection.getBalance(walletB.publicKey, "confirmed");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletA.publicKey,
      toPubkey: walletB.publicKey,
      lamports,
    }),
  );

  let signature;
  try {
    signature = await sendAndConfirmTransaction(connection, tx, [walletA], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      commitment: "finalized",
    });
  } catch (error) {
    console.log(`STATUS: TRANSFER FAILED — cause category: ${category(error)}`);
    return;
  }

  // A freshly confirmed signature may not be queryable at finalized commitment
  // immediately; poll within a bound rather than reporting a false negative.
  let parsed = null;
  for (let attempt = 0; attempt < 20 && !parsed; attempt += 1) {
    parsed = await connection.getParsedTransaction(signature, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
    if (!parsed) await new Promise((r) => setTimeout(r, 3_000));
  }
  const keys = parsed?.transaction.message.accountKeys.map((k) => new PublicKey(k.pubkey).toBase58()) ?? [];
  const indexA = keys.indexOf(walletA.publicKey.toBase58());
  const indexB = keys.indexOf(walletB.publicKey.toBase58());
  const deltaB =
    indexB >= 0 && parsed?.meta
      ? parsed.meta.postBalances[indexB] - parsed.meta.preBalances[indexB]
      : null;
  const afterB = await connection.getBalance(walletB.publicKey, "finalized");

  console.log(`signature: ${signature}`);
  console.log(`explorer:  https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log(`sender in tx:    ${indexA >= 0 ? "verified" : "NOT FOUND"}`);
  console.log(`recipient in tx: ${indexB >= 0 ? "verified" : "NOT FOUND"}`);
  console.log(`recipient credited: ${deltaB === null ? "unknown" : deltaB / LAMPORTS_PER_SOL} SOL`);
  console.log(`wallet B balance: ${(afterB - beforeB) / LAMPORTS_PER_SOL} SOL delta, ${afterB / LAMPORTS_PER_SOL} SOL total`);
  const ok = parsed?.meta?.err === null && deltaB === lamports && indexA >= 0 && indexB >= 0;
  console.log(`STATUS: ${ok ? "TRANSFER VERIFIED (finalized)" : "UNVERIFIED — do not treat as success"}`);
}

main().catch((error) => {
  console.log(`STATUS: aborted — cause category: ${category(error)}`);
  process.exit(1);
});
