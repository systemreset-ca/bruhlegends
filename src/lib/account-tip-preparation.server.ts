import bs58 from "bs58";
import { admin } from "./db.server";
import { accountWalletForTelegram, accountWalletsEnabled } from "./account-wallet.server";
import { readDevnetAccount } from "./account-wallet-balance.server";
import {
  accountTipLamports,
  buildAccountSolTipMessage,
  accountMessageBase64,
} from "./account-sol-tip-message";

function safe(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid devnet quote.");
  return value;
}
function identity(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 4503599627370495)
    throw new Error("Invalid Telegram identity.");
}

/** Internal only: context must come from a verified webhook, never request JSON.
 * Reserves an intent; does not authorize, sign, broadcast or award a tip.
 */
export async function prepareAccountTip(input: {
  telegramChatId: number;
  telegramMessageId: number;
  senderUserId: number;
  recipientUserId: number;
  amount: string;
}) {
  if (
    !accountWalletsEnabled() ||
    process.env["SOLANA_NETWORK"] !== "devnet" ||
    process.env["BRUH_ACCOUNT_TIPS_DEVNET_ENABLED"] !== "true"
  )
    throw new Error("Account tip preparation unavailable.");
  identity(input.senderUserId);
  identity(input.recipientUserId);
  identity(input.telegramMessageId);
  if (
    !Number.isSafeInteger(input.telegramChatId) ||
    input.telegramChatId >= 0 ||
    input.telegramChatId < -4503599627370495 ||
    input.senderUserId === input.recipientUserId
  )
    throw new Error("Invalid tip context.");
  const lamports = accountTipLamports(input.amount);
  const db = await admin();
  const groupResult = await db
    .from("groups")
    .select("id,telegram_chat_id,is_paused,removed_at")
    .eq("telegram_chat_id", input.telegramChatId)
    .maybeSingle();
  const group = groupResult.data;
  if (
    groupResult.error ||
    !group ||
    String(group.telegram_chat_id) !== String(input.telegramChatId) ||
    group.is_paused !== false ||
    group.removed_at != null
  )
    throw new Error("Group unavailable for tipping.");
  const membershipResult = await db
    .from("group_members")
    .select("id,group_id,telegram_user_id,is_banned,pseudonym")
    .eq("group_id", group.id)
    .in("telegram_user_id", [input.senderUserId, input.recipientUserId]);
  const members = membershipResult.data as Array<{
    group_id: string;
    telegram_user_id: number | string;
    is_banned: boolean;
    pseudonym: string | null;
  }> | null;
  if (
    membershipResult.error ||
    !members ||
    members.length !== 2 ||
    members.some(
      (member) =>
        member.group_id !== group.id || member.is_banned !== false || member.pseudonym != null,
    ) ||
    ![input.senderUserId, input.recipientUserId].every(
      (user) =>
        members.filter((member) => String(member.telegram_user_id) === String(user)).length === 1,
    )
  )
    throw new Error("Group members unavailable for tipping.");
  const requestKey = `tg:${input.telegramChatId}:${input.telegramMessageId}:${input.senderUserId}`;
  const existing = await db.rpc("bruh_account_tip_find_request", {
    p_request_key: requestKey,
    p_user_id: input.senderUserId,
  });
  if (existing.error) throw new Error("Tip storage unavailable.");
  if (existing.data) {
    const record = existing.data as Record<string, unknown>;
    if (
      record["network"] !== "devnet" ||
      String(record["sender_user_id"]) !== String(input.senderUserId) ||
      String(record["recipient_user_id"]) !== String(input.recipientUserId) ||
      String(record["telegram_chat_id"]) !== String(input.telegramChatId) ||
      String(record["lamports"]) !== lamports.toString() ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        String(record["id"]),
      ) ||
      !["reserved", "signed", "finalized", "cancelled"].includes(String(record["state"]))
    )
      throw new Error("Tip request conflict.");
    return { id: String(record["id"]), state: String(record["state"]), reused: true };
  }
  const sender = await accountWalletForTelegram(input.senderUserId, false);
  const recipient = await accountWalletForTelegram(input.recipientUserId, false);
  if (!sender || !recipient || sender.address === recipient.address)
    throw new Error("Account wallet unavailable.");
  const latest = (await readDevnetAccount("getLatestBlockhash", [{ commitment: "finalized" }])) as {
    context: { slot: unknown };
    value: { blockhash: string; lastValidBlockHeight: unknown };
  };
  const blockSlot = safe(latest?.context?.slot);
  safe(latest?.value?.lastValidBlockHeight);
  const reference = bs58.encode(crypto.getRandomValues(new Uint8Array(32)));
  const message = buildAccountSolTipMessage({
    network: "devnet",
    sender: sender.address,
    recipient: recipient.address,
    reference,
    blockhash: latest.value.blockhash,
    lamports,
  });
  const feeResult = (await readDevnetAccount("getFeeForMessage", [
    accountMessageBase64(message),
    { commitment: "finalized", minContextSlot: blockSlot },
  ])) as { context: { slot: unknown }; value: unknown };
  if (safe(feeResult?.context?.slot) < blockSlot) throw new Error("Stale devnet quote.");
  const fee = safe(feeResult?.value);
  const balance = (await readDevnetAccount("getBalance", [
    sender.address,
    { commitment: "finalized", minContextSlot: blockSlot },
  ])) as { context: { slot: unknown }; value: unknown };
  const observedSlot = safe(balance?.context?.slot);
  if (observedSlot < blockSlot || lamports + BigInt(fee) > BigInt(safe(balance?.value)))
    throw new Error("Insufficient or stale devnet balance.");
  const id = crypto.randomUUID();
  const reserved = await db.rpc("bruh_account_tip_reserve", {
    p_record: {
      id,
      requestKey,
      chatId: String(input.telegramChatId),
      senderUserId: String(input.senderUserId),
      recipientUserId: String(input.recipientUserId),
      network: "devnet",
      reference,
      lamports: lamports.toString(),
      feeLamports: String(fee),
      observedBalance: String(balance.value),
      observedSlot: String(observedSlot),
      expiresAt: new Date(Date.now() + 180000).toISOString(),
    },
  });
  if (
    reserved.error ||
    !reserved.data ||
    reserved.data.id !== id ||
    reserved.data.state !== "reserved" ||
    reserved.data.sender_address !== sender.address ||
    reserved.data.recipient_address !== recipient.address ||
    String(reserved.data.lamports) !== lamports.toString() ||
    String(reserved.data.fee_lamports) !== String(fee) ||
    reserved.data.reference !== reference
  )
    throw new Error("Tip reservation unavailable.");
  return { id, state: "reserved", reused: false };
}
