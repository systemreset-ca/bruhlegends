import { randomBytes, timingSafeEqual } from "node:crypto";
import { admin } from "./db.server";
import {
  grantHash,
  secureActionHash,
  secureActionUser,
  SECURE_ACTION_PBKDF2_ITERATIONS,
  validIntentId,
} from "./secure-action.server";
import {
  exportAccountWalletSecret,
  importAccountWrappingKey,
  type AccountWalletEnvelope,
} from "./account-wallet-vault.server";

export function walletExportGate(): void {
  if (
    process.env["SOLANA_NETWORK"] !== "devnet" ||
    process.env["BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED"] !== "true" ||
    process.env["BRUH_ACCOUNT_WALLET_EXPORT_DEVNET_ENABLED"] !== "true"
  )
    throw new Error("Wallet export unavailable.");
}

function exportRecord(value: unknown, userId: number, id?: string) {
  const record = value as Record<string, unknown> | null;
  if (
    !record ||
    (id && record["id"] !== id) ||
    String(record["telegram_user_id"]) !== String(userId) ||
    record["network"] !== "devnet" ||
    !validIntentId(String(record["id"])) ||
    !validIntentId(String(record["wallet_id"])) ||
    typeof record["address"] !== "string"
  )
    throw new Error("Wallet export unavailable.");
  return {
    id: String(record["id"]),
    walletId: String(record["wallet_id"]),
    address: String(record["address"]),
    network: "devnet" as const,
    status: String(record["status"]),
    expiresAt: String(record["expires_at"]),
  };
}

/** Authenticated bot-only request. Returns no key material. */
export async function requestWalletExport(userId: number) {
  walletExportGate();
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 4503599627370495)
    throw new Error("Wallet export unavailable.");
  const db = await admin();
  const result = await db.rpc("bruh_account_wallet_export_request", { p_user_id: userId });
  if (result.error) throw new Error("Wallet export unavailable.");
  return exportRecord(result.data, userId);
}

export async function readWalletExport(userId: number, exportId: string) {
  walletExportGate();
  const db = await admin();
  const result = await db.rpc("bruh_account_wallet_export_read", {
    p_id: exportId,
    p_user_id: userId,
  });
  if (result.error) throw new Error("Wallet export unavailable.");
  return exportRecord(result.data, userId, exportId);
}

async function authorizeWalletExport(userId: number, exportId: string, password: string) {
  walletExportGate();
  if (!validIntentId(exportId)) throw new Error("Authorization unavailable.");
  const db = await admin();
  const challenge = await db.rpc("bruh_account_wallet_export_begin", {
    p_user_id: userId,
    p_export_id: exportId,
  });
  const c = challenge.data as {
    allowed?: boolean;
    nonce?: string;
    saltHex?: string;
    hashHex?: string;
    iterations?: number;
  } | null;
  if (
    challenge.error ||
    !c ||
    c.allowed !== true ||
    !c.nonce ||
    !validIntentId(c.nonce) ||
    !c.saltHex ||
    !c.hashHex ||
    !/^[0-9a-f]{64}$/.test(c.hashHex) ||
    c.iterations !== SECURE_ACTION_PBKDF2_ITERATIONS
  )
    throw new Error("Authorization unavailable or temporarily locked.");
  const hash = await secureActionHash(password, c.saltHex, userId);
  let ok = false;
  try {
    ok = timingSafeEqual(hash, Buffer.from(c.hashHex, "hex"));
  } finally {
    hash.fill(0);
  }
  const token = randomBytes(24).toString("base64url");
  const finished = await db.rpc("bruh_account_wallet_export_finish", {
    p_user_id: userId,
    p_export_id: exportId,
    p_nonce: c.nonce,
    p_ok: ok,
    p_token_hash: grantHash(token),
  });
  if (!ok || finished.error || finished.data !== true)
    throw new Error("Authorization unavailable.");
  return token;
}

/** Single-use reveal. The key is returned only to the verified Mini App call. */
export async function revealWalletExport(input: {
  session: string;
  initData: string;
  exportId: string;
  password: string;
}) {
  const userId = await secureActionUser(input.session, input.initData);
  const token = await authorizeWalletExport(userId, input.exportId, input.password);
  const db = await admin();
  const consumed = await db.rpc("bruh_account_wallet_export_consume", {
    p_id: input.exportId,
    p_user_id: userId,
    p_token_hash: grantHash(token),
  });
  const record = consumed.data as Record<string, unknown> | null;
  if (consumed.error || !record || record["wallet_id"] == null || record["address"] == null)
    throw new Error("Wallet export unavailable or already consumed.");
  const stored = await db.rpc("bruh_account_wallet_read", { p_user_id: String(userId) });
  const envelope = stored.data as AccountWalletEnvelope | null;
  const version = process.env["BRUH_ACCOUNT_WALLET_KEY_VERSION"];
  const wrappingSecret = process.env["BRUH_ACCOUNT_WALLET_WRAPPING_KEY"];
  if (
    stored.error ||
    !envelope ||
    envelope.id !== record["wallet_id"] ||
    envelope.address !== record["address"] ||
    envelope.telegramUserId !== String(userId) ||
    envelope.network !== "devnet" ||
    envelope.keyVersion !== version ||
    !wrappingSecret
  )
    throw new Error("Wallet export unavailable.");
  const secretKey = await exportAccountWalletSecret(
    envelope,
    await importAccountWrappingKey(wrappingSecret),
  );
  return { address: envelope.address, secretKey, clearAfterSeconds: 60 as const };
}

export async function authenticatedWalletExportRead(input: {
  session: string;
  initData: string;
  exportId: string;
}) {
  const userId = await secureActionUser(input.session, input.initData);
  return readWalletExport(userId, input.exportId);
}
