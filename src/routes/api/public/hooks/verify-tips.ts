import { createFileRoute } from "@tanstack/react-router";
import { admin } from "@/lib/db.server";
import { sweepTipIntents } from "@/lib/tips.server";
import { pruneRetention, purgeExpiredCredentials } from "@/lib/moderation.server";
import {
  dispatchAnnouncement,
  flushDigests,
  loadGroupAnnounceSettings,
  publicName,
} from "@/lib/announce.server";
import { escapeHtml } from "@/lib/telegram.server";
import { isAuthorizedSchedulerRequest } from "@/lib/scheduler-auth.server";

type AnnouncementMember = {
  id: string;
  display_name: string | null;
  pseudonym: string | null;
};

/**
 * Scheduler entry point for money-side maintenance: verify outstanding tips
 * on-chain, announce the confirmed ones under the group's privacy rules, flush
 * any digests that are due, then purge expired credentials and age out raw
 * payloads.
 */
export const Route = createFileRoute("/api/public/hooks/verify-tips")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedSchedulerRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const sweep = await sweepTipIntents();
        const db = await admin();
        let announced = 0;
        let queued = 0;

        for (const confirmation of sweep.confirmed) {
          const { data: intent } = await db
            .from("tip_intents")
            .select("id, group_id, privacy, amount_display, asset_symbol, sender_membership_id, recipient_membership_id")
            .eq("id", confirmation.intentId)
            .maybeSingle();
          if (!intent) continue;

          const group = await loadGroupAnnounceSettings(intent.group_id);

          const { data: members } = await db
            .from("group_members")
            .select("id, display_name, pseudonym")
            .in("id", [intent.sender_membership_id, intent.recipient_membership_id]);
          const announcementMembers = (members ?? []) as AnnouncementMember[];
          const sender = announcementMembers.find((member) => member.id === intent.sender_membership_id);
          const recipient = announcementMembers.find(
            (member) => member.id === intent.recipient_membership_id,
          );
          if (!sender || !recipient) continue;

          const senderName = publicName(intent.privacy, sender);
          if (!senderName) continue; // private tips are never broadcast

          const decision = await dispatchAnnouncement({
            group,
            kind: "tip",
            dedupeKey: `tip:${intent.id}`,
            body: [
              `💸 <b>${escapeHtml(senderName)}</b> tipped <b>${escapeHtml(recipient.display_name ?? "a member")}</b>`,
              `${intent.amount_display} ${escapeHtml(intent.asset_symbol)} — verified on-chain.`,
            ].join("\n"),
          });
          if (decision === "send") announced += 1;
          else if (decision === "queue") queued += 1;
        }

        const digests = await flushDigests();
        await purgeExpiredCredentials();
        const retention = await pruneRetention();

        return Response.json({
          ok: true,
          checked: sweep.checked,
          confirmed: sweep.confirmed.length,
          expired: sweep.expired,
          announced,
          queued,
          digestsSent: digests.sent,
          prunedObservations: retention.prunedObservations,
        });
      },
    },
  },
});

