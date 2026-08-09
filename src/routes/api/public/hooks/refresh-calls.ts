import { createFileRoute } from "@tanstack/react-router";
import { refreshCalls } from "@/lib/calls.server";
import { admin } from "@/lib/db.server";
import { sendMessage, escapeHtml } from "@/lib/telegram.server";
import { canAnnounce, loadGroupAnnounceSettings } from "@/lib/announce.server";

/**
 * Called by the scheduler. Refreshes open calls, then announces each milestone
 * exactly once — the announced_at stamp is what makes it once.
 */
export const Route = createFileRoute("/api/public/hooks/refresh-calls")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const result = await refreshCalls();
        const db = await admin();

        for (const hit of result.milestones) {
          const { data: call } = await db
            .from("calls")
            .select("symbol, mint, group_id, group_members(display_name)")
            .eq("id", hit.callId)
            .maybeSingle();
          if (!call) continue;

          const group = await loadGroupAnnounceSettings(call.group_id);
          if (canAnnounce(group, "milestone")) {
            await sendMessage(
              group!.telegram_chat_id,
              [
                `🚀 <b>${escapeHtml(call.symbol ?? call.mint.slice(0, 6))}</b> hit <b>${hit.milestone}x</b>`,
                `Called by ${escapeHtml(call.group_members?.display_name ?? "a member")} — now ${hit.multiple.toFixed(2)}x from baseline.`,
              ].join("\n"),
            );
            await db
              .from("milestones")
              .update({ announced_at: new Date().toISOString() })
              .eq("call_id", hit.callId)
              .eq("milestone", hit.milestone);
          }
        }


        return Response.json({
          ok: true,
          refreshed: result.refreshed,
          quarantined: result.quarantined,
          milestones: result.milestones.length,
        });
      },
    },
  },
});
