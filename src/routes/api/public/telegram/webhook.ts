import { createFileRoute } from "@tanstack/react-router";
import { deriveTelegramWebhookSecret, safeEqual } from "@/lib/telegram.server";
import {
  isTelegramUpdate,
  processTelegramOutboxByUpdateId,
  processTelegramUpdateById,
  storeTelegramUpdate,
} from "@/lib/telegram-updates.server";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(provided, deriveTelegramWebhookSecret())) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: unknown;
        try {
          update = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!isTelegramUpdate(update)) {
          return new Response("Invalid Telegram update", { status: 400 });
        }

        // Acknowledge only after durable receipt. A database failure returns a
        // retryable response. The inline attempt keeps chat replies fast; the
        // scheduler retains the same durable retry and dead-letter behavior.
        try {
          await storeTelegramUpdate(update);
        } catch (error) {
          console.error("Telegram update receipt failed", error);
          return new Response("Receipt unavailable", { status: 503 });
        }

        try {
          const processing = await processTelegramUpdateById(update.update_id);
          const deliveries =
            processing.processed > 0
              ? await processTelegramOutboxByUpdateId(update.update_id)
              : { claimed: 0, sent: 0, failed: 0, deadLettered: 0 };
          return Response.json({ ok: true, accepted: true, processing, deliveries });
        } catch (error) {
          console.error("Immediate Telegram processing unavailable; queued for retry", error);
          return Response.json({ ok: true, accepted: true, queued: true });
        }
      },
    },
  },
});
