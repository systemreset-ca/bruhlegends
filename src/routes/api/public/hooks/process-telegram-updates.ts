import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedSchedulerRequest } from "@/lib/scheduler-auth.server";
import { processTelegramUpdateBatch } from "@/lib/telegram-updates.server";

export const Route = createFileRoute("/api/public/hooks/process-telegram-updates")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedSchedulerRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        return Response.json({ ok: true, ...(await processTelegramUpdateBatch()) });
      },
    },
  },
});
