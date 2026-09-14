/** Isolated owner-authorized exercise, never a production webhook or signer.
 * node --experimental-strip-types tools/db-validation/twelve-account-devnet.mjs [--live]
 * Public JSON only; all wallet envelopes/wrapping material remain in memory.
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { ed25519 } from "@noble/curves/ed25519.js";
import bs58 from "bs58";
import { PGlite } from "@electric-sql/pglite";
import {
  generateAccountWallet,
  importAccountWrappingKey,
  verifyAccountWallet,
} from "../../src/lib/account-wallet-vault.server.ts";
import { matchAccountSolTipReceipt } from "../../src/lib/account-sol-tip-receipt.ts";

const live = process.argv.includes("--live");
const genesis = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const system = "11111111111111111111111111111111";
const report = {
  syntheticIdentities: true,
  liveTelegramAuthenticationTested: false,
  productionSigningTested: false,
  generatedAt: new Date().toISOString(),
  network: "devnet",
  accounts: [],
  calls: 48,
  transactions: [],
  checks: {},
  status: "local_only",
};
const output = new URL(
  live
    ? "../../docs/operations/twelve-account-devnet-results.json"
    : "../../docs/operations/twelve-account-devnet-local-results.json",
  import.meta.url,
);
async function saveReport() {
  if (!process.argv.includes("--no-report"))
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const key = await importAccountWrappingKey(
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex"),
);
const wallets = [];
for (let i = 0; i < 12; i++) {
  const id = String(9000000000000 + i);
  const wallet = await generateAccountWallet(id, "isolated-test-v1", key);
  await verifyAccountWallet(wallet, key);
  const externalSeed = crypto.getRandomValues(new Uint8Array(32));
  report.accounts.push({
    syntheticTelegramUserId: id,
    internalAddress: wallet.address,
    externalPublicAddress: bs58.encode(ed25519.getPublicKey(externalSeed)),
  });
  externalSeed.fill(0);
  wallets.push(wallet);
}
assert.equal(new Set(wallets.map((w) => w.address)).size, 12);
await assert.rejects(
  verifyAccountWallet({ ...wallets[0], telegramUserId: wallets[1].telegramUserId }, key),
);
report.checks.encryptedWalletGenerationAndOwnershipBinding = true;

const db = new PGlite();
const fixture = await readFile(new URL("./community-leaderboard.pg.mjs", import.meta.url), "utf8");
// Reuse the existing isolated minimal schema; never connect to Cloud.
await db.exec(fixture.split("await db.exec(`")[1].split("INSERT INTO telegram_users")[0]);
for (let i = 0; i < 12; i++) {
  const id = report.accounts[i].syntheticTelegramUserId;
  await db.query("INSERT INTO telegram_users VALUES($1,$2,NULL)", [id, `synthetic_${i + 1}`]);
  for (let g = 0; g < 3; g++)
    await db.query("INSERT INTO group_members(id,group_id,telegram_user_id) VALUES($1,$2,$3)", [
      `m${i}g${g}`,
      `g${g}`,
      id,
    ]);
  for (let c = 0; c < 4; c++)
    await db.query(
      "INSERT INTO calls(id,group_id,caller_membership_id,mint,ath_multiple,status,source,baseline_price_usd) VALUES($1,$2,$3,$4,$5,'active','explicit',1)",
      [`c${i}_${c}`, `g${c % 3}`, `m${i}g${c % 3}`, wallets[(i + c) % 12].address, 1 + (i + c) / 4],
    );
}
await db.exec(
  await readFile(new URL("../../docs/proposed-community-leaderboard.sql", import.meta.url), "utf8"),
);
async function boards() {
  const rows = (
    await db.query("SELECT bruh_community_leaderboard('all',100,'devnet','callers') AS board")
  ).rows[0].board;
  assert.equal(rows.length, 12);
  assert.equal(
    rows.reduce((n, row) => n + row.calls, 0),
    48,
  );
  assert.ok(rows.every((row) => row.calls === 4 && row.groups === 3 && row.ranked));
  const groups = (
    await db.query(
      "SELECT group_id,count(*)::int AS calls FROM calls GROUP BY group_id ORDER BY group_id",
    )
  ).rows;
  assert.deepEqual(
    groups.map((g) => g.calls),
    [24, 12, 12],
  );
  return {
    communityCallers: rows,
    groupCallCounts: groups,
    communityTippers: (
      await db.query("SELECT bruh_community_leaderboard('all',100,'devnet','tippers') AS board")
    ).rows[0].board,
  };
}
report.boards = await boards();
report.checks.twelveAccountsAcrossThreeGroups = true;
if (!live) {
  // Synthetic proofs test aggregation only. They are never called on-chain receipts.
  for (let t = 0; t < 24; t++) {
    const i = t % 12,
      j = (i + 1) % 12,
      g = t % 3;
    await db.query(
      "INSERT INTO tip_intents(id,group_id,sender_membership_id,recipient_membership_id,status,privacy,network,amount_base_units,recipient_address) VALUES($1,$2,$3,$4,'confirmed','public','devnet',100000,$5)",
      [`fixture${t}`, `g${g}`, `m${i}g${g}`, `m${j}g${g}`, wallets[j].address],
    );
    await db.query(
      "INSERT INTO verified_transfers(tip_intent_id,signature,amount_base_units,recipient_address) VALUES($1,$2,100000,$3)",
      [`fixture${t}`, `synthetic-proof-${t}`, wallets[j].address],
    );
  }
  report.boards = await boards();
  assert.equal(report.boards.communityTippers.length, 12);
  assert.ok(
    report.boards.communityTippers.every((row) => row.tipsSent === 2 && row.tipsReceived === 2),
  );
  report.checks.syntheticTwentyFourTipAggregationOnly = true;
  report.status = "local_wallet_call_and_synthetic_tip_aggregation_verified";
}
await saveReport();
console.log(
  "LOCAL PASS: 12 encrypted internal wallets, 12 external public candidates, 48 calls across 3 groups; community aggregation verified.",
);

const endpoint = process.env.BRUH_DEVNET_API_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${process.env.BRUH_DEVNET_API_KEY}`
  : process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
async function rpc(method, params = []) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 429) throw new Error("rate_limited");
  if (!response.ok) throw new Error("provider_http_error");
  const payload = await response.json();
  if (payload.error)
    throw new Error(
      payload.error.code === -32005 ? "rate_limited" : `rpc_code_${payload.error.code}`,
    );
  return payload.result;
}
async function transfer(sender, recipient, lamports, kind) {
  const reference = bs58.encode(crypto.getRandomValues(new Uint8Array(32)));
  const block = (await rpc("getLatestBlockhash", [{ commitment: "confirmed" }])).value;
  const data = Buffer.alloc(12);
  data.writeUInt32LE(2);
  data.writeBigUInt64LE(BigInt(lamports), 4);
  const message = Buffer.concat([
    Buffer.from([1, 0, 2, 4]),
    ...[sender.address, recipient.address, reference, system].map((a) =>
      Buffer.from(bs58.decode(a)),
    ),
    Buffer.from(bs58.decode(block.blockhash)),
    Buffer.from([1, 3, 3, 0, 1, 2, 12]),
    data,
  ]);
  // Test-only decrypt using the exact production envelope AAD, not a new app export path.
  const aad = new TextEncoder().encode(
    JSON.stringify([
      "bruh-account-wallet-v1",
      sender.id,
      sender.telegramUserId,
      sender.network,
      sender.address,
      sender.keyVersion,
    ]),
  );
  const seed = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: Buffer.from(sender.ivHex, "hex"),
        additionalData: aad,
        tagLength: 128,
      },
      key,
      Buffer.from(sender.ciphertextHex, "hex"),
    ),
  );
  let raw;
  try {
    raw = Buffer.concat([Buffer.from([1]), Buffer.from(ed25519.sign(message, seed)), message]);
  } finally {
    seed.fill(0);
  }
  const simulated = await rpc("simulateTransaction", [
    raw.toString("base64"),
    { encoding: "base64", sigVerify: true, commitment: "confirmed" },
  ]);
  assert.equal(simulated.value.err, null);
  const signature = await rpc("sendTransaction", [
    raw.toString("base64"),
    { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 2 },
  ]);
  raw.fill(0);
  // Persist signature immediately, including if later confirmation fails.
  const entry = {
    kind,
    sender: sender.address,
    recipient: recipient.address,
    lamports,
    reference,
    signature,
    explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    finalized: false,
  };
  report.transactions.push(entry);
  await saveReport();
  let receipt;
  for (let attempt = 0; attempt < 40; attempt++) {
    receipt = await rpc("getTransaction", [
      signature,
      { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 },
    ]);
    if (receipt) break;
    await pause(3000);
  }
  assert.ok(receipt, "Finalized receipt unavailable within bound");
  assert.equal(
    matchAccountSolTipReceipt(receipt, {
      signature,
      sender: sender.address,
      recipient: recipient.address,
      reference,
      lamports: BigInt(lamports),
      feeLamports: BigInt(receipt.meta.fee),
    }).matched,
    true,
  );
  assert.equal(
    matchAccountSolTipReceipt(receipt, {
      signature,
      sender: sender.address,
      recipient: recipient.address,
      reference,
      lamports: BigInt(lamports + 1),
    }).matched,
    false,
  );
  entry.finalized = true;
  entry.slot = receipt.slot;
  entry.feeLamports = receipt.meta.fee;
  console.log(`${kind} finalized: ${signature}`);
  return entry;
}
try {
  if (live) {
    assert.equal(await rpc("getGenesisHash"), genesis);
    report.provider = process.env.BRUH_DEVNET_API_KEY
      ? "Helius devnet"
      : process.env.SOLANA_RPC_URL
        ? "configured RPC"
        : "public Solana devnet";
    console.log(`DEVNET funding address: ${wallets[0].address}`);
    try {
      report.airdropSignature = await rpc("requestAirdrop", [wallets[0].address, 100000000]);
    } catch (error) {
      report.airdropFailure = error.message;
      console.log(
        `One faucet attempt failed: ${error.message}. Waiting up to 15 minutes for 0.05 devnet SOL at the funding address; no faucet retries.`,
      );
    }
    let funded = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (
        (await rpc("getBalance", [wallets[0].address, { commitment: "confirmed" }])).value >=
        50000000
      ) {
        funded = true;
        break;
      }
      await pause(15000);
    }
    if (!funded) throw new Error("devnet_funding_unavailable");
    for (let i = 1; i < 12; i++) await transfer(wallets[0], wallets[i], 3000000, "test_funding");
    for (let t = 0; t < 24; t++) {
      const i = t % 12,
        j = (i + 1) % 12,
        g = t % 3;
      const entry = await transfer(wallets[i], wallets[j], 100000, "tip");
      await db.query(
        "INSERT INTO tip_intents(id,group_id,sender_membership_id,recipient_membership_id,status,privacy,network,amount_base_units,recipient_address) VALUES($1,$2,$3,$4,'confirmed','public','devnet',$5,$6)",
        [`t${t}`, `g${g}`, `m${i}g${g}`, `m${j}g${g}`, entry.lamports, entry.recipient],
      );
      await db.query(
        "INSERT INTO verified_transfers(tip_intent_id,signature,amount_base_units,recipient_address) VALUES($1,$2,$3,$4)",
        [`t${t}`, entry.signature, entry.lamports, entry.recipient],
      );
      report.boards = await boards();
      await saveReport();
    }
    assert.ok(
      report.boards.communityTippers.every((row) => row.tipsSent === 2 && row.tipsReceived === 2),
    );
    assert.equal(report.boards.communityTippers.length, 12);
    report.status = "devnet_transfers_and_isolated_rankings_verified";
  }
} catch (error) {
  // Do not surface fetch/provider errors containing endpoint credentials.
  report.status = "live_incomplete";
  report.failure =
    /^(rate_limited|provider_http_error|rpc_code_-?[0-9]+|devnet_funding_unavailable)$/.test(
      error.message,
    )
      ? error.message
      : "verification_or_provider_failure";
  console.log(`LIVE INCOMPLETE: ${report.failure}`);
  process.exitCode = 1;
} finally {
  await saveReport();
  await db.close();
}
