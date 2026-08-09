import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/policy-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "BRUH Terms of Use — Non-custodial bot, no financial advice" },
      {
        name: "description",
        content:
          "Terms for using the BRUH Telegram bot and Mini App: non-custodial by design, group-administered, provided as-is with no investment advice.",
      },
      { property: "og:title", content: "BRUH Terms of Use" },
      {
        property: "og:description",
        content: "How BRUH may be used, what it does not do, and who is responsible for what.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsRoute,
});

function TermsRoute() {
  return (
    <PolicyPage
      title="Terms of Use"
      updated="February 2026"
      intro="By adding BRUH to a Telegram group, or by using the bot or Mini App, you agree to these terms. If you do not agree, remove the bot and stop using it."
      sections={[
        {
          heading: "What BRUH is",
          body: [
            "BRUH is a record-keeping and coordination tool for Telegram communities. It timestamps token calls, tracks their market performance from public data, ranks contributors within their own group, and prepares Solana Pay requests so members can tip each other directly.",
          ],
        },
        {
          heading: "Non-custodial by design",
          body: [
            "BRUH never holds, requests or stores private keys, seed phrases or funds. It cannot initiate, reverse or recover a transfer. Every payment is constructed as a request that you approve in your own wallet, and the transaction happens directly between wallets on Solana.",
            "Once a transaction is signed and broadcast it is final. Verify the recipient address and amount before approving.",
          ],
        },
        {
          heading: "No financial advice",
          body: [
            "Nothing produced by BRUH — calls, scores, leaderboards, milestones or announcements — is investment advice, an endorsement, or a recommendation to buy or sell anything. Scores measure recorded past outcomes on public data and say nothing about future results.",
          ],
        },
        {
          heading: "Acceptable use",
          body: [
            "Do not use BRUH to manipulate markets, coordinate pump-and-dump schemes, impersonate other members, launder funds, or evade sanctions or local law. Do not attempt to spoof calls, forge signatures, or interfere with scoring.",
            "Group admins are responsible for their community's conduct and configuration. Accounts and groups that abuse the service may be removed without notice.",
          ],
        },
        {
          heading: "Availability and accuracy",
          body: [
            "BRUH depends on Telegram, public Solana RPC endpoints and third-party market data. Those can be delayed, incomplete or unavailable, so prices, milestones and scores may lag or be revised. The service is provided as-is with no warranty of uptime or accuracy.",
          ],
        },
        {
          heading: "Liability",
          body: [
            "To the maximum extent permitted by law, the operators of BRUH are not liable for trading losses, missed or mistaken transfers, gas or network fees, data inaccuracies, or any indirect or consequential damages arising from use of the service.",
          ],
        },
        {
          heading: "Changes",
          body: [
            "These terms may change as the product evolves. Continued use after an update means acceptance of the revised terms.",
          ],
        },
      ]}
    />
  );
}
