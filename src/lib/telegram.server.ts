import { createHash, timingSafeEqual } from "node:crypto";
import { queueTelegramAction } from "./telegram-delivery-context.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const PER_CHAT_SEND_INTERVAL_MS = 1_100;
const lastScheduledSendByChat = new Map<string, number>();

export class TelegramRateLimitError extends Error {
  constructor(
    public readonly method: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(`Telegram ${method} rate limited; retry after ${retryAfterSeconds}s`);
    this.name = "TelegramRateLimitError";
  }
}

export function telegramSendDelayMs(previousSendAtMs: number, nowMs: number): number {
  return Math.max(0, previousSendAtMs + PER_CHAT_SEND_INTERVAL_MS - nowMs);
}

function retryAfterFromValue(value: unknown, depth = 0): number | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  const record = value as Record<string, unknown>;
  const direct = record["retry_after"];
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) {
    return Math.min(300, Math.ceil(direct));
  }
  for (const nested of Object.values(record)) {
    const found = retryAfterFromValue(nested, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

export function telegramRetryAfterSeconds(status: number, body: string): number | null {
  if (status !== 429) return null;
  try {
    return retryAfterFromValue(JSON.parse(body)) ?? 1;
  } catch {
    return 1;
  }
}

async function waitForTelegramChatSlot(chatId: number | string): Promise<void> {
  const key = String(chatId);
  const now = Date.now();
  const previous = lastScheduledSendByChat.get(key) ?? 0;
  const waitMs = telegramSendDelayMs(previous, now);
  const scheduledAt = now + waitMs;
  lastScheduledSendByChat.set(key, scheduledAt);

  if (lastScheduledSendByChat.size > 1_000) {
    for (const [storedKey, storedAt] of lastScheduledSendByChat) {
      if (storedAt + PER_CHAT_SEND_INTERVAL_MS < now) lastScheduledSendByChat.delete(storedKey);
    }
  }

  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

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
    const retryAfterSeconds = telegramRetryAfterSeconds(response.status, text);
    if (retryAfterSeconds !== null) {
      console.error(`Telegram gateway ${method} rate limited; retry after ${retryAfterSeconds}s`);
      throw new TelegramRateLimitError(method, retryAfterSeconds);
    }
    console.error(`Telegram gateway ${method} failed [${response.status}]`);
    throw new Error(`Telegram request failed [${response.status}]`);
  }
  const parsed = JSON.parse(text) as {
    ok: boolean;
    result?: T;
    description?: string;
    error_code?: number;
    parameters?: { retry_after?: number };
  };
  if (!parsed.ok) {
    const retryAfterSeconds = retryAfterFromValue(parsed);
    if (parsed.error_code === 429 || retryAfterSeconds !== null) {
      const retryAfter = retryAfterSeconds ?? 1;
      console.error(`Telegram API ${method} rate limited; retry after ${retryAfter}s`);
      throw new TelegramRateLimitError(method, retryAfter);
    }
    console.error(`Telegram API ${method} error: ${parsed.description}`);
    throw new Error(`Telegram API error: ${parsed.description ?? "unknown"}`);
  }
  return parsed.result as T;
}

export function telegramActionChatId(
  method: string,
  payload: Record<string, unknown>,
): number | string | null {
  if (method !== "sendMessage" && method !== "editMessageText") return null;
  const chatId = payload["chat_id"];
  return typeof chatId === "number" || typeof chatId === "string" ? chatId : null;
}

/** Sends one already-durable action while retaining the normal per-chat pace. */
export async function deliverTelegramAction<T = unknown>(
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const chatId = telegramActionChatId(method, payload);
  if (chatId !== null) await waitForTelegramChatSlot(chatId);
  return telegramCall<T>(method, payload);
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
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    disable_notification: options.silent ?? false,
    ...(options.replyToMessageId ? { reply_to_message_id: options.replyToMessageId } : {}),
    ...(options.keyboard ? { reply_markup: { inline_keyboard: options.keyboard } } : {}),
  };
  if (await queueTelegramAction("sendMessage", body)) return { message_id: 0 };
  await waitForTelegramChatSlot(chatId);
  return telegramCall<{ message_id: number }>("sendMessage", body);
}

export async function answerCallbackQuery(id: string, text?: string, alert = false) {
  const body = {
    callback_query_id: id,
    ...(text ? { text, show_alert: alert } : {}),
  };
  if (await queueTelegramAction("answerCallbackQuery", body)) return;
  return telegramCall("answerCallbackQuery", body);
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
) {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  };
  if (await queueTelegramAction("editMessageText", body)) return;
  await waitForTelegramChatSlot(chatId);
  return telegramCall("editMessageText", body);
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
