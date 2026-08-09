import { createHash, timingSafeEqual } from "node:crypto";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function credentials() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const telegramKey = process.env["TELEGRAM_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!telegramKey) throw new Error("TELEGRAM_API_KEY is not configured");
  return { lovableKey, telegramKey };
}

/**
 * Webhook secret derived from the connection key so the setWebhook call and the
 * webhook route agree without storing a second secret.
 */
export function deriveTelegramWebhookSecret(): string {
  const { telegramKey } = credentials();
  return createHash("sha256").update(`telegram-webhook:${telegramKey}`).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function telegramCall<T = unknown>(
  method: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const { lovableKey, telegramKey } = credentials();
  const response = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`Telegram gateway ${method} failed [${response.status}]: ${text}`);
    throw new Error(`Telegram request failed [${response.status}]: ${text}`);
  }
  const parsed = JSON.parse(text) as { ok: boolean; result?: T; description?: string };
  if (!parsed.ok) {
    console.error(`Telegram API ${method} error: ${parsed.description}`);
    throw new Error(`Telegram API error: ${parsed.description ?? "unknown"}`);
  }
  return parsed.result as T;
}

/** Escapes text for Telegram HTML parse mode. Token metadata is never trusted. */
export function escapeHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type InlineKeyboard = { text: string; callback_data?: string; url?: string }[][];

export async function sendMessage(
  chatId: number | string,
  text: string,
  options: { keyboard?: InlineKeyboard; replyToMessageId?: number; silent?: boolean } = {},
) {
  return telegramCall<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    disable_notification: options.silent ?? false,
    ...(options.replyToMessageId ? { reply_to_message_id: options.replyToMessageId } : {}),
    ...(options.keyboard ? { reply_markup: { inline_keyboard: options.keyboard } } : {}),
  });
}

export async function answerCallbackQuery(id: string, text?: string, alert = false) {
  return telegramCall("answerCallbackQuery", {
    callback_query_id: id,
    ...(text ? { text, show_alert: alert } : {}),
  });
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
) {
  return telegramCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export async function isChatAdmin(chatId: number, userId: number): Promise<boolean> {
  try {
    const member = await telegramCall<{ status: string }>("getChatMember", {
      chat_id: chatId,
      user_id: userId,
    });
    return member.status === "creator" || member.status === "administrator";
  } catch {
    return false;
  }
}
