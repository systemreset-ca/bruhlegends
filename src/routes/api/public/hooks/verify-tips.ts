import { createFileRoute } from "@tanstack/react-router";
import { admin } from "@/lib/db.server";
import { sweepTipIntents } from "@/lib/tips.server";
import { pruneRetention, purgeExpiredCredentials } from "@/lib/moderation.server";
import { canAnnounce, loadGroupAnnounceSettings, publicName } from "@/lib/announce.server";
import { sendMessage, escapeHtml } from "@/lib/telegram.server";

/**
 * Scheduler entry point for money-side maintenance: verify outstanding tips
 * on-chain, announce the confirmed ones under the group's privacy rules, then
 * purge expired credentials and age out raw payloads.
 */
export const Route = createFileRoute("/api/public/hooks/verify-tips")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const sweep = await sweepTipIntents();
        const db = await admin();
        let announced = 0;

        for (const confirmation of sweep.confirmed) {
          const { data: intent } = await db
            .from("tip_intents")
            .select("id, group_id, privacy, amount_display, asset_symbol, sender_membership_id, recipient_membership_id")
            .eq("id", confirmation.intentId)
            .maybeSingle();
          if (!intent) continue;

          const group = await loadGroupAnnounceSettings(intent.group_id);
          if (!canAnnounce(group, "tip")) continue;

          const { data: members } = await db
            .from("group_members")
            .select("id, display_name, pseudonym")
            .in("id", [intent.sender_membership_id, intent.recipient_membership_id]);
          const sender = (members ?? []).find((m: any) => m.id === intent.sender_membership_id);
          const recipient = (members ?? []).find(
            (m: any) => m.id === intent.recipient_membership_id,
          );
          if (!sender || !recipient) continue;

          const senderName = publicName(intent.privacy, sender);
          if (!senderName) continue; // private tips are never broadcast

          await sendMessage(
            group!.telegram_chat_id,
            [
              `💸 <b>${escapeHtml(senderName)}</b> tipped <b>${escapeHtml(recipient.display_name ?? "a member")}</b>`,
              `${intent.amount_display} ${escapeHtml(intent.asset_symbol)} — verified on-chain.`,
            ].join("\n"),
          );
          announced += 1;
        }

        await purgeExpiredCredentials();
        const retention = await pruneRetention();

        return Response.json({
          ok: true,
          checked: sweep.checked,
          confirmed: sweep.confirmed.length,
          expired: sweep.expired,
          announced,
          prunedObservations: retention.prunedObservations,
        });
      },
    },
  },
});
