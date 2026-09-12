import { createFileRoute } from "@tanstack/react-router";
import { flushDigests } from "@/lib/announce.server";
import { purgeExpiredCredentials } from "@/lib/moderation.server";
import { isAuthorizedSchedulerRequest } from "@/lib/scheduler-auth.server";

/** Flushes due announcement digests and removes expired one-shot credentials. */
export const Route = createFileRoute("/api/public/hooks/maintenance-hourly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedSchedulerRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const digests = await flushDigests();
        await purgeExpiredCredentials();
        return Response.json({ ok: true, digestGroups: digests.groups, digestsSent: digests.sent });
      },
    },
  },
});
