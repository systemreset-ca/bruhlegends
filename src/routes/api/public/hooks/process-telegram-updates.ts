import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedSchedulerRequest } from "@/lib/scheduler-auth.server";
import {
  processTelegramOutboxBatch,
  processTelegramUpdateBatch,
} from "@/lib/telegram-updates.server";

export const Route = createFileRoute("/api/public/hooks/process-telegram-updates")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedSchedulerRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const updates = await processTelegramUpdateBatch();
        const deliveries = await processTelegramOutboxBatch();
        return Response.json({ ok: true, ...updates, deliveries });
      },
    },
  },
});
