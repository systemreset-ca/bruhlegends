import { createFileRoute } from "@tanstack/react-router";
import { pruneRetention } from "@/lib/moderation.server";
import { isAuthorizedSchedulerRequest } from "@/lib/scheduler-auth.server";

/** Applies group retention windows to stored raw provider and Telegram payloads. */
export const Route = createFileRoute("/api/public/hooks/prune-retention")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedSchedulerRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        return Response.json({ ok: true, ...(await pruneRetention()) });
      },
    },
  },
});
