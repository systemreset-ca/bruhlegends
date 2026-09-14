import { admin } from "./db.server";
import {
  generateAccountWallet,
  importAccountWrappingKey,
  verifyAccountWallet,
  type AccountWalletEnvelope,
} from "./account-wallet-vault.server";

export function accountWalletsEnabled(): boolean {
  return process.env["BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED"] === "true";
}

/** Only call with authenticated Telegram webhook identity, never user-supplied address/id. */
export async function accountWalletForTelegram(userId: number, create: boolean) {
  if (!accountWalletsEnabled() || process.env["SOLANA_NETWORK"] !== "devnet")
    throw new Error("Devnet account wallets are disabled.");
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 4503599627370495)
    throw new Error("Invalid Telegram identity.");
  const keyHex = process.env["BRUH_ACCOUNT_WALLET_WRAPPING_KEY"];
  const version = process.env["BRUH_ACCOUNT_WALLET_KEY_VERSION"];
  if (!keyHex || !version) throw new Error("Account wallet encryption is not configured.");
  const key = await importAccountWrappingKey(keyHex);
  const db = await admin();
  const telegramUserId = String(userId);
  const found = await db.rpc("bruh_account_wallet_read", { p_user_id: telegramUserId });
  if (found.error) throw new Error("Wallet storage unavailable.");
  let record = found.data as AccountWalletEnvelope | null;
  if (!record && create) {
    const candidate = await generateAccountWallet(telegramUserId, version, key);
    const persisted = await db.rpc("bruh_account_wallet_provision", { p_record: candidate });
    if (persisted.error || !persisted.data) throw new Error("Wallet creation unavailable.");
    // Database atomically returns the winning wallet even for simultaneous starts.
    record = persisted.data as AccountWalletEnvelope;
  }
  if (!record) return null;
  if (
    record.telegramUserId !== telegramUserId ||
    record.network !== "devnet" ||
    record.keyVersion !== version
  )
    throw new Error("Wallet scope mismatch.");
  await verifyAccountWallet(record, key);
  // Never return the envelope/ciphertext to the bot presentation layer.
  return { id: record.id, address: record.address, network: "devnet" as const };
}
