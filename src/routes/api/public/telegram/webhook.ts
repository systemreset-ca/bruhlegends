import { createFileRoute } from "@tanstack/react-router";
import { deriveTelegramWebhookSecret, safeEqual } from "@/lib/telegram.server";
import { handleUpdate } from "@/lib/bot.server";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(provided, deriveTelegramWebhookSecret())) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json()) as { update_id?: number };
        if (typeof update.update_id !== "number") {
          return Response.json({ ok: true, ignored: true });
        }

        // Telegram retries anything that isn't a fast 200, so failures are
        // logged and swallowed rather than replayed forever.
        try {
          await handleUpdate(update as never);
        } catch (error) {
          console.error("Telegram update handling failed", error);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
