import { createFileRoute } from "@tanstack/react-router";
import { deriveTelegramWebhookSecret, safeEqual } from "@/lib/telegram.server";
import { isTelegramUpdate, storeTelegramUpdate } from "@/lib/telegram-updates.server";

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
        // retryable response; processing happens through the scheduler worker.
        try {
          await storeTelegramUpdate(update);
        } catch (error) {
          console.error("Telegram update receipt failed", error);
          return new Response("Receipt unavailable", { status: 503 });
        }
        return Response.json({ ok: true, accepted: true });
      },
    },
  },
});
