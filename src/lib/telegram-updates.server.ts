import { admin } from "./db.server";
import { handleUpdate, type TelegramUpdate } from "./bot.server";
import { TelegramRateLimitError } from "./telegram.server";

const MAX_ATTEMPTS = 10;

export function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  if (!value || typeof value !== "object") return false;
  const updateId = (value as { update_id?: unknown }).update_id;
  return typeof updateId === "number" && Number.isSafeInteger(updateId) && updateId >= 0;
}

export function telegramUpdateType(update: TelegramUpdate): string {
  if (update.callback_query) return "callback_query";
  if (update.my_chat_member) return "my_chat_member";
  if (update.message) return "message";
  if (update.edited_message) return "edited_message";
  return "unknown";
}

export function telegramChatId(update: TelegramUpdate): number | null {
  return (
    update.callback_query?.message?.chat.id ??
    update.my_chat_member?.chat.id ??
    update.message?.chat.id ??
    update.edited_message?.chat.id ??
    null
  );
}

export function retryDelaySeconds(attemptCount: number): number {
  return Math.min(300, 5 * 2 ** Math.max(0, attemptCount - 1));
}

export function retryDelayForErrorSeconds(attemptCount: number, error: unknown): number {
  const backoff = retryDelaySeconds(attemptCount);
  return error instanceof TelegramRateLimitError
    ? Math.max(backoff, error.retryAfterSeconds)
    : backoff;
}

export async function storeTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const db = await admin();
  const { error } = await db.from("webhook_updates").upsert(
    {
      telegram_update_id: update.update_id,
      telegram_chat_id: telegramChatId(update),
      update_type: telegramUpdateType(update),
      payload: update,
      status: "received",
    },
    { onConflict: "telegram_update_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

type ClaimedUpdate = {
  telegram_update_id: number;
  payload: unknown;
  attempt_count: number;
  lock_token: string;
};

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}

export async function processTelegramUpdateBatch(limit = 10): Promise<{
  claimed: number;
  processed: number;
  failed: number;
  deadLettered: number;
}> {
  const db = await admin();
  const { data, error } = await db.rpc("claim_telegram_updates", {
    p_limit: limit,
    p_lease_seconds: 300,
  });
  if (error) throw error;

  const claimed = (data ?? []) as ClaimedUpdate[];
  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const row of claimed) {
    try {
      if (!isTelegramUpdate(row.payload) || row.payload.update_id !== row.telegram_update_id) {
        throw new Error("Stored Telegram payload does not match its update id");
      }

      await handleUpdate(row.payload);
      const { error: completionError } = await db
        .from("webhook_updates")
        .update({
          status: "processed",
          processed_at: new Date().toISOString(),
          locked_at: null,
          lock_token: null,
          last_error: null,
        })
        .eq("telegram_update_id", row.telegram_update_id)
        .eq("lock_token", row.lock_token);
      if (completionError) throw completionError;
      processed += 1;
    } catch (processingError) {
      const exhausted = row.attempt_count >= MAX_ATTEMPTS;
      const retryAt = new Date(
        Date.now() + retryDelayForErrorSeconds(row.attempt_count, processingError) * 1000,
      ).toISOString();
      const { error: failureError } = await db
        .from("webhook_updates")
        .update({
          status: exhausted ? "dead_letter" : "failed",
          next_attempt_at: retryAt,
          locked_at: null,
          lock_token: null,
          last_error: errorMessage(processingError),
        })
        .eq("telegram_update_id", row.telegram_update_id)
        .eq("lock_token", row.lock_token);
      if (failureError) throw failureError;
      if (exhausted) deadLettered += 1;
      else failed += 1;
    }
  }

  return { claimed: claimed.length, processed, failed, deadLettered };
}
