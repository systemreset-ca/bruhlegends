import { createFileRoute } from "@tanstack/react-router";
import { refreshCalls } from "@/lib/calls.server";
import { admin } from "@/lib/db.server";
import { escapeHtml } from "@/lib/telegram.server";
import { dispatchAnnouncement, loadGroupAnnounceSettings } from "@/lib/announce.server";
import { isAuthorizedSchedulerRequest } from "@/lib/scheduler-auth.server";

/**
 * Called by the scheduler. Refreshes open calls, then announces each milestone
 * exactly once — the announced_at stamp is what makes it once. Quiet hours and
 * digest modes park the message in the queue instead of dropping it.
 */
export const Route = createFileRoute("/api/public/hooks/refresh-calls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedSchedulerRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const result = await refreshCalls();
        const db = await admin();
        let announced = 0;
        let queued = 0;

        for (const hit of result.milestones) {
          const { data: call } = await db
            .from("calls")
            .select("symbol, mint, group_id, group_members(display_name)")
            .eq("id", hit.callId)
            .maybeSingle();
          if (!call) continue;

          const group = await loadGroupAnnounceSettings(call.group_id);
          const decision = await dispatchAnnouncement({
            group,
            kind: "milestone",
            dedupeKey: `milestone:${hit.callId}:${hit.milestone}`,
            body: [
              `🚀 <b>${escapeHtml(call.symbol ?? call.mint.slice(0, 6))}</b> hit <b>${hit.milestone}x</b>`,
              `Called by ${escapeHtml(call.group_members?.display_name ?? "a member")} — now ${hit.multiple.toFixed(2)}x from baseline.`,
            ].join("\n"),
          });

          if (decision === "drop") continue;
          if (decision === "send") announced += 1;
          else queued += 1;

          await db
            .from("milestones")
            .update({ announced_at: new Date().toISOString() })
            .eq("call_id", hit.callId)
            .eq("milestone", hit.milestone);
        }

        return Response.json({
          ok: true,
          refreshed: result.refreshed,
          quarantined: result.quarantined,
          milestones: result.milestones.length,
          announced,
          queued,
        });
      },
    },
  },
});
