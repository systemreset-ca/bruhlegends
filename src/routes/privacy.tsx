import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/policy-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "BRUH Privacy — What the bot stores" },
      {
        name: "description",
        content:
          "BRUH stores your Telegram id, calls, verified wallet address and confirmed tips. Group records can contribute to local and community rankings.",
      },
      { property: "og:title", content: "BRUH Privacy Policy" },
      {
        property: "og:description",
        content:
          "Clear data handling for calls, group records, community rankings, wallets, export and erasure.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyRoute,
});

function PrivacyRoute() {
  return (
    <PolicyPage
      title="Privacy"
      updated="February 2026"
      intro="BRUH records the minimum needed to score calls. Every call keeps its source group while verified performance may also contribute to community-wide rankings."
      sections={[
        {
          heading: "What is stored",
          body: [
            "Your Telegram user id, display name and optional pseudonym; the calls you record, including the mint, the price baseline captured at that moment, and later price observations; milestones your calls reach; the Solana address you verify; and tip intents plus their on-chain confirmations.",
            "Group settings, moderator actions and dispute outcomes are stored as an audit trail so decisions can be reviewed by the group's admins.",
          ],
        },
        {
          heading: "What is never stored",
          body: [
            "The private key or seed phrase of a wallet you already own. BRUH cannot sign a transaction on behalf of your own wallet — every transfer is approved by you.",
            "BRUH generates one account wallet per verified Telegram account. Only that generated key is kept, always encrypted, and it is never shown in chat.",
            "General chat history. Passive detection only reads messages for token mints, only when a group has enabled it, and only for members who have not used /optout.",
          ],
        },

        {
          heading: "Group and community rankings",
          body: [
            "Each call stays attached to the group where it was made. BRUH can use those verified records for both that group's leaderboard and a community-wide leaderboard tied to your Telegram account. Your BRUH account wallet also follows your Telegram account across groups.",
          ],
        },
        {
          heading: "Retention",
          body: [
            "Each group sets how long raw market and audit payloads are kept, defaulting to 30 days. After that window the raw payloads are cleared and only the derived figures remain. One-time login links, sessions and wallet challenges are deleted as soon as they expire.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "Send /export in a group to download everything BRUH holds about you there as a CSV file. Send /forgetme to revoke your wallet link, switch your record to a pseudonym, turn off passive detection and clear your call notes.",
            "Calls themselves remain in the group ledger after erasure because other members' scores and the group's history depend on them — but they are no longer tied to your identity.",
          ],
        },
        {
          heading: "Third parties",
          body: [
            "BRUH talks to Telegram for messaging, to public Solana RPC endpoints for transfer verification, and to public market data providers for pricing. It does not sell data or run advertising.",
          ],
        },
      ]}
    />
  );
}
