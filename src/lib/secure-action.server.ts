import { pbkdf2, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { admin } from "./db.server";
import { resolveSession, verifyInitData } from "./session.server";
import { accountWalletsEnabled } from "./account-wallet.server";

const derive = promisify(pbkdf2);
export function accountTipGate(): void {
  if (
    !accountWalletsEnabled() ||
    process.env["SOLANA_NETWORK"] !== "devnet" ||
    process.env["BRUH_ACCOUNT_TIPS_DEVNET_ENABLED"] !== "true"
  )
    throw new Error("Account tips unavailable.");
}
export function validIntentId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}
export function grantHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export async function secureActionUser(session: string, initData: string): Promise<number> {
  accountTipGate();
  if (session.length < 8 || session.length > 200 || initData.length > 4096)
    throw new Error("Authentication unavailable.");
  const resolved = await resolveSession(session);
  const verified = verifyInitData(initData, 300);
  if (
    !resolved ||
    !verified ||
    resolved.telegramUserId !== verified ||
    !Number.isSafeInteger(verified) ||
    verified <= 0 ||
    verified > 4503599627370495
  )
    throw new Error("Authentication unavailable.");
  return verified;
}
export async function secureActionHash(
  password: string,
  saltHex: string,
  userId: number,
): Promise<Buffer> {
  if (
    typeof password !== "string" ||
    password.length < 15 ||
    Buffer.byteLength(password, "utf8") > 256 ||
    !/^[0-9a-f]{32}$/.test(saltHex) ||
    !Number.isSafeInteger(userId) ||
    userId <= 0
  )
    throw new Error("Invalid Secure Action Password.");
  const salt = Buffer.concat([
    Buffer.from(saltHex, "hex"),
    Buffer.from(`bruh-secure-action-v1:${userId}`),
  ]);
  return derive(password, salt, 600000, 32, "sha256");
}
export async function enrollSecureAction(input: {
  session: string;
  initData: string;
  password: string;
  confirmation: string;
}) {
  const userId = await secureActionUser(input.session, input.initData);
  if (input.password !== input.confirmation) throw new Error("Passwords do not match.");
  const db = await admin();
  const lease = await db.rpc("bruh_secure_action_setup_begin", { p_user_id: userId });
  if (lease.error || typeof lease.data !== "string" || !validIntentId(lease.data))
    throw new Error("Secure Action Password setup unavailable or already complete.");
  const salt = randomBytes(16).toString("hex");
  const hash = await secureActionHash(input.password, salt, userId);
  try {
    const result = await db.rpc("bruh_secure_action_enroll", {
      p_user_id: userId,
      p_nonce: lease.data,
      p_salt: salt,
      p_hash: hash.toString("hex"),
    });
    if (result.error || result.data !== true)
      throw new Error("Secure Action Password setup unavailable or already complete.");
    return { enrolled: true };
  } finally {
    hash.fill(0);
  }
}

/** Internal grant remains server-side, never returned by a public handler. */
export async function authorizeAccountTip(
  userId: number,
  intentId: string,
  password: string,
): Promise<string> {
  accountTipGate();
  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    userId > 4503599627370495 ||
    !validIntentId(intentId)
  )
    throw new Error("Authorization unavailable.");
  const db = await admin();
  const challenge = await db.rpc("bruh_secure_action_begin", {
    p_user_id: userId,
    p_intent_id: intentId,
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
    c.iterations !== 600000
  )
    throw new Error("Authorization unavailable or temporarily locked.");
  const hash = await secureActionHash(password, c.saltHex, userId);
  let ok;
  try {
    ok = timingSafeEqual(hash, Buffer.from(c.hashHex, "hex"));
  } finally {
    hash.fill(0);
  }
  const token = randomBytes(24).toString("base64url");
  const finished = await db.rpc("bruh_secure_action_finish", {
    p_user_id: userId,
    p_intent_id: intentId,
    p_nonce: c.nonce,
    p_ok: ok,
    p_token_hash: grantHash(token),
  });
  if (!ok || finished.error || finished.data !== true)
    throw new Error("Authorization unavailable.");
  return token;
}
