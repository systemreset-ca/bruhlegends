import bs58 from "bs58";
import { admin } from "./db.server";
import { accountWalletsEnabled } from "./account-wallet.server";
import { verifyFinalizedAccountSolTip } from "./account-wallet-balance.server";

function userIdentity(userId: number): void {
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 4503599627370495)
    throw new Error("Invalid account identity.");
}
function decimal(value: unknown): bigint {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid settlement record.");
    return BigInt(value);
  }
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,15})$/.test(value))
    throw new Error("Invalid settlement record.");
  const result = BigInt(value);
  if (result > 9007199254740991n) throw new Error("Invalid settlement record.");
  return result;
}
function encoded(value: unknown, size: number): string {
  if (typeof value !== "string" || bs58.decode(value).length !== size)
    throw new Error("Invalid settlement record.");
  return value;
}

/** Internal reconciliation only. No route or bot caller; no signing or broadcast. */
export async function reconcileAccountTip(intentId: string, authenticatedSenderId: number) {
  userIdentity(authenticatedSenderId);
  if (
    !accountWalletsEnabled() ||
    process.env["SOLANA_NETWORK"] !== "devnet" ||
    process.env["BRUH_ACCOUNT_TIPS_DEVNET_ENABLED"] !== "true" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(intentId)
  )
    throw new Error("Account tip reconciliation unavailable.");
  const db = await admin();
  const read = await db.rpc("bruh_account_tip_read", {
    p_id: intentId,
    p_user_id: authenticatedSenderId,
  });
  if (read.error || !read.data) throw new Error("Account tip unavailable.");
  const record = read.data as Record<string, unknown>;
  if (
    record["id"] !== intentId ||
    record["intent_id"] !== intentId ||
    record["network"] !== "devnet" ||
    decimal(record["sender_user_id"]) !== BigInt(authenticatedSenderId) ||
    !["signed", "finalized"].includes(String(record["state"]))
  )
    throw new Error("Invalid settlement scope.");
  const lamports = decimal(record["lamports"]);
  const fee = decimal(record["fee_lamports"]);
  if (lamports === 0n) throw new Error("Invalid settlement record.");
  const signature = encoded(record["signature"], 64);
  const proof = await verifyFinalizedAccountSolTip({
    signature,
    sender: encoded(record["sender_address"], 32),
    recipient: encoded(record["recipient_address"], 32),
    reference: encoded(record["reference"], 32),
    lamports,
    feeLamports: fee,
  });
  // Missing, ambiguous or unmatched receipt never releases a reservation.
  if (!proof.matched || proof.slot === undefined) return { settled: false };
  const settled = await db.rpc("bruh_account_tip_finalize", {
    p_id: intentId,
    p_user_id: authenticatedSenderId,
    p_signature: signature,
    p_slot: proof.slot,
    p_fee: fee.toString(),
  });
  if (
    settled.error ||
    !settled.data ||
    settled.data.state !== "finalized" ||
    settled.data.id !== intentId ||
    settled.data.signature !== signature
  )
    throw new Error("Account tip settlement unavailable.");
  return { settled: true, signature, slot: proof.slot };
}
