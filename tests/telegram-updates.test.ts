import { describe, expect, it } from "vitest";
import {
  isTelegramUpdate,
  retryDelaySeconds,
  telegramChatId,
  telegramUpdateType,
} from "../src/lib/telegram-updates.server";

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
});
