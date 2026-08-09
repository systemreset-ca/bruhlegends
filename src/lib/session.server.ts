import { createHash, randomBytes } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export type MiniAppSession = {
  telegramUserId: number;
  groupId: string | null;
};

/**
 * Mini App identity comes from a one-time login link the bot delivers in a
 * private chat, exchanged for a short-lived session. The browser never asserts
 * who it is; the server resolves identity from the stored session hash only.
 */
export async function createLoginToken(
  telegramUserId: number,
  groupId: string | null,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = newToken();
  const { error } = await supabaseAdmin.from("miniapp_login_tokens").insert({
    token_hash: hashToken(token),
    telegram_user_id: telegramUserId,
    group_id: groupId,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) throw error;
  return token;
}

export async function exchangeLoginToken(token: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("miniapp_login_tokens")
    .select("id, telegram_user_id, group_id, expires_at, consumed_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!data || data.consumed_at || new Date(data.expires_at) < new Date()) return null;

  await supabaseAdmin
    .from("miniapp_login_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id);

  const sessionToken = newToken();
  const { error } = await supabaseAdmin.from("miniapp_sessions").insert({
    session_hash: hashToken(sessionToken),
    telegram_user_id: data.telegram_user_id,
    group_id: data.group_id,
    expires_at: new Date(Date.now() + 12 * 60 * 60_000).toISOString(),
  });
  if (error) throw error;
  return sessionToken;
}

export async function resolveSession(
  sessionToken: string | null | undefined,
): Promise<MiniAppSession | null> {
  if (!sessionToken) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("miniapp_sessions")
    .select("telegram_user_id, group_id, expires_at")
    .eq("session_hash", hashToken(sessionToken))
    .maybeSingle();

  if (!data || new Date(data.expires_at) < new Date()) return null;
  return { telegramUserId: Number(data.telegram_user_id), groupId: data.group_id };
}
