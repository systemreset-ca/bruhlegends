import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519.js";
import { admin } from "./db.server";
import { grantHash, accountTipGate, validIntentId } from "./secure-action.server";
import { readDevnetAccount, writeDevnetAccount } from "./account-wallet-balance.server";
import {
  buildAccountSolTipMessage,
  accountMessageBase64,
  type AccountSolTipMessageInput,
} from "./account-sol-tip-message";
import {
  importAccountWrappingKey,
  signAccountWalletSolTip,
  type AccountWalletEnvelope,
} from "./account-wallet-vault.server";
import { reconcileAccountTip } from "./account-tip-settlement.server";

function decimal(value: unknown): bigint {
  if (!/^(0|[1-9][0-9]{0,15})$/.test(String(value))) throw new Error("Invalid execution record.");
  const result = BigInt(String(value));
  if (result > 9007199254740991n) throw new Error("Invalid execution record.");
  return result;
}
function address(value: unknown): string {
  if (typeof value !== "string" || bs58.decode(value).length !== 32)
    throw new Error("Invalid execution record.");
  return value;
}
/** Rebuild and cryptographically validate persisted bytes before any recovery send. */
export function validatePersistedAccountTip(record: Record<string, unknown>): {
  signature: string;
  signedTransaction: string;
} {
  if (
    typeof record["signed_transaction"] !== "string" ||
    record["signed_transaction"].length !== 332 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(record["signed_transaction"])
  )
    throw new Error("Invalid persisted transaction.");
  const raw = Uint8Array.from(atob(record["signed_transaction"]), (char) => char.charCodeAt(0));
  if (
    raw.length !== 248 ||
    raw[0] !== 1 ||
    accountMessageBase64(raw) !== record["signed_transaction"]
  )
    throw new Error("Invalid persisted transaction.");
  const signature = raw.slice(1, 65),
    message = raw.slice(65);
  const rebuilt = buildAccountSolTipMessage({
    network: "devnet",
    sender: address(record["sender_address"]),
    recipient: address(record["recipient_address"]),
    reference: address(record["reference"]),
    blockhash: bs58.encode(message.slice(132, 164)),
    lamports: decimal(record["lamports"]),
  });
  if (
    record["network"] !== "devnet" ||
    bs58.encode(signature) !== record["signature"] ||
    !message.every((byte, index) => byte === rebuilt[index]) ||
    !ed25519.verify(signature, message, bs58.decode(String(record["sender_address"])))
  )
    throw new Error("Invalid persisted transaction.");
  return { signature: bs58.encode(signature), signedTransaction: record["signed_transaction"] };
}

/** Internal approved execution; caller must resolve identity and SAP before invoking. */
export async function executeAuthorizedAccountTip(
  intentId: string,
  senderUserId: number,
  token: string,
) {
  accountTipGate();
  if (
    process.env["BRUH_ACCOUNT_SIGNING_DEVNET_ENABLED"] !== "true" ||
    !validIntentId(intentId) ||
    !Number.isSafeInteger(senderUserId) ||
    senderUserId <= 0 ||
    senderUserId > 4503599627370495 ||
    !/^[A-Za-z0-9_-]{32}$/.test(token)
  )
    throw new Error("Account tip execution unavailable.");
  const db = await admin();
  const authorized = await db.rpc("bruh_account_tip_authorized_read", {
    p_id: intentId,
    p_user_id: senderUserId,
    p_token_hash: grantHash(token),
  });
  const record = authorized.data as Record<string, unknown> | null;
  if (
    authorized.error ||
    !record ||
    record["id"] !== intentId ||
    record["intent_id"] !== intentId ||
    String(record["sender_user_id"]) !== String(senderUserId) ||
    record["network"] !== "devnet" ||
    !["reserved", "signed"].includes(String(record["state"]))
  )
    throw new Error("Tip authorization unavailable.");
  let signed: { signature: string; signedTransaction: string };
  let lastHeight: bigint;
  if (record["state"] === "signed") {
    signed = validatePersistedAccountTip(record);
    const result = await reconcileAccountTip(intentId, senderUserId);
    if (result.settled) return { state: "finalized", signature: signed.signature };
    const fee = (await readDevnetAccount("getFeeForMessage", [
      accountMessageBase64(
        Uint8Array.from(atob(signed.signedTransaction), (char) => char.charCodeAt(0)).slice(65),
      ),
      { commitment: "finalized", minContextSlot: Number(decimal(record["observed_slot"])) },
    ])) as { context: { slot: unknown }; value: unknown };
    if (
      fee?.value === null ||
      decimal(fee?.value) !== decimal(record["fee_lamports"]) ||
      decimal(fee?.context?.slot) < decimal(record["observed_slot"])
    )
      throw new Error("Persisted tip fee unavailable. Reservation retained.");
    lastHeight = decimal(record["last_valid_block_height"]);
  } else {
    if (
      !Number.isFinite(Date.parse(String(record["expires_at"]))) ||
      Date.parse(String(record["expires_at"])) <= Date.now()
    )
      throw new Error("Tip intent expired.");
    const latest = (await readDevnetAccount("getLatestBlockhash", [
      { commitment: "finalized" },
    ])) as {
      context: { slot: unknown };
      value: { blockhash: string; lastValidBlockHeight: unknown };
    };
    lastHeight = decimal(latest?.value?.lastValidBlockHeight);
    const minSlot = decimal(latest?.context?.slot);
    if (lastHeight === 0n || minSlot < decimal(record["observed_slot"]))
      throw new Error("Stale execution quote.");
    const input: AccountSolTipMessageInput = {
      network: "devnet",
      sender: address(record["sender_address"]),
      recipient: address(record["recipient_address"]),
      reference: address(record["reference"]),
      blockhash: address(latest.value.blockhash),
      lamports: decimal(record["lamports"]),
    };
    const message = buildAccountSolTipMessage(input);
    const fee = (await readDevnetAccount("getFeeForMessage", [
      accountMessageBase64(message),
      { commitment: "finalized", minContextSlot: Number(minSlot) },
    ])) as { context: { slot: unknown }; value: unknown };
    if (
      fee?.value === null ||
      decimal(fee?.value) !== decimal(record["fee_lamports"]) ||
      decimal(fee?.context?.slot) < minSlot
    )
      throw new Error("Network fee changed.");
    const balance = (await readDevnetAccount("getBalance", [
      input.sender,
      { commitment: "finalized", minContextSlot: Number(minSlot) },
    ])) as { context: { slot: unknown }; value: unknown };
    if (
      decimal(balance?.context?.slot) < minSlot ||
      decimal(balance?.value) < input.lamports + decimal(record["fee_lamports"])
    )
      throw new Error("Insufficient execution balance.");
    const unsigned = new Uint8Array(65 + message.length);
    unsigned[0] = 1;
    unsigned.set(message, 65);
    const simulated = (await writeDevnetAccount("simulateTransaction", [
      accountMessageBase64(unsigned),
      { encoding: "base64", sigVerify: false, commitment: "confirmed" },
    ])) as { value: { err: unknown } };
    if (!simulated || !simulated.value || simulated.value.err !== null)
      throw new Error("Tip simulation failed.");
    const stored = await db.rpc("bruh_account_wallet_read", { p_user_id: String(senderUserId) });
    const envelope = stored.data as AccountWalletEnvelope | null;
    if (
      stored.error ||
      !envelope ||
      envelope.id !== record["sender_wallet_id"] ||
      envelope.telegramUserId !== String(senderUserId) ||
      envelope.address !== input.sender ||
      envelope.network !== "devnet" ||
      envelope.keyVersion !== process.env["BRUH_ACCOUNT_WALLET_KEY_VERSION"]
    )
      throw new Error("Signing wallet unavailable.");
    const secret = process.env["BRUH_ACCOUNT_WALLET_WRAPPING_KEY"];
    if (!secret) throw new Error("Signing wallet unavailable.");
    signed = await signAccountWalletSolTip(envelope, await importAccountWrappingKey(secret), input);
  }
  const simulation = (await writeDevnetAccount("simulateTransaction", [
    signed.signedTransaction,
    { encoding: "base64", sigVerify: true, commitment: "confirmed" },
  ])) as { value: { err: unknown } };
  if (!simulation || !simulation.value || simulation.value.err !== null)
    throw new Error("Signed tip simulation failed.");
  const persisted = await db.rpc("bruh_account_tip_authorized_signed", {
    p_id: intentId,
    p_user_id: senderUserId,
    p_token_hash: grantHash(token),
    p_signature: signed.signature,
    p_transaction: signed.signedTransaction,
    p_last_height: lastHeight.toString(),
  });
  if (
    persisted.error ||
    !persisted.data ||
    persisted.data.state !== "signed" ||
    persisted.data.signature !== signed.signature ||
    persisted.data.signed_transaction !== signed.signedTransaction
  )
    throw new Error("Signed tip persistence unavailable.");
  // No signed bytes are sent to RPC until the atomic grant-consume/persist succeeds.
  let submitted;
  try {
    submitted = await writeDevnetAccount("sendTransaction", [
      signed.signedTransaction,
      { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 0 },
    ]);
  } catch {
    return { state: "signed", signature: signed.signature, submissionUnknown: true };
  }
  if (submitted !== signed.signature)
    return { state: "signed", signature: signed.signature, submissionUnknown: true };
  return { state: "submitted", signature: signed.signature };
}
