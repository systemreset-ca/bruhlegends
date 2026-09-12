import { describe, expect, it } from "vitest";
import {
  isTelegramUpdate,
  retryDelayForErrorSeconds,
  retryDelaySeconds,
  telegramChatId,
  telegramUpdateType,
} from "../src/lib/telegram-updates.server";
import {
  TelegramRateLimitError,
  telegramRetryAfterSeconds,
  telegramSendDelayMs,
} from "../src/lib/telegram.server";

describe("Telegram update queue helpers", () => {
  it("accepts only non-negative safe integer update ids", () => {
    expect(isTelegramUpdate({ update_id: 42, message: {} })).toBe(true);
    expect(isTelegramUpdate({ update_id: -1 })).toBe(false);
    expect(isTelegramUpdate({ update_id: 1.5 })).toBe(false);
    expect(isTelegramUpdate({ update_id: Number.MAX_SAFE_INTEGER + 1 })).toBe(false);
    expect(isTelegramUpdate(null)).toBe(false);
  });

  it("labels supported Telegram update shapes", () => {
    expect(telegramUpdateType({ update_id: 1, callback_query: {} as never })).toBe(
      "callback_query",
    );
    expect(telegramUpdateType({ update_id: 2, my_chat_member: {} as never })).toBe(
      "my_chat_member",
    );
    expect(telegramUpdateType({ update_id: 3, message: {} as never })).toBe("message");
    expect(telegramUpdateType({ update_id: 4 })).toBe("unknown");
  });

  it("extracts the group or private chat id used for retention", () => {
    expect(
      telegramChatId({
        update_id: 1,
        message: { message_id: 9, chat: { id: -100123, type: "supergroup" } },
      }),
    ).toBe(-100123);
    expect(telegramChatId({ update_id: 2 })).toBeNull();
  });

  it("backs off retries and caps them at five minutes", () => {
    expect(retryDelaySeconds(1)).toBe(5);
    expect(retryDelaySeconds(2)).toBe(10);
    expect(retryDelaySeconds(7)).toBe(300);
    expect(retryDelaySeconds(20)).toBe(300);
  });

  it("spaces messages to the same chat by more than one second", () => {
    expect(telegramSendDelayMs(1_000, 1_500)).toBe(600);
    expect(telegramSendDelayMs(1_000, 2_100)).toBe(0);
  });

  it("extracts Telegram retry_after values without trusting arbitrary failures", () => {
    expect(telegramRetryAfterSeconds(429, '{"parameters":{"retry_after":7}}')).toBe(7);
    expect(telegramRetryAfterSeconds(429, "not-json")).toBe(1);
    expect(telegramRetryAfterSeconds(500, '{"retry_after":7}')).toBeNull();
  });

  it("honors Telegram retry_after when it exceeds queue backoff", () => {
    expect(retryDelayForErrorSeconds(2, new TelegramRateLimitError("sendMessage", 23))).toBe(23);
    expect(retryDelayForErrorSeconds(4, new TelegramRateLimitError("sendMessage", 3))).toBe(40);
  });
});
