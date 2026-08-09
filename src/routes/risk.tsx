import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/policy-page";

export const Route = createFileRoute("/risk")({
  head: () => ({
    meta: [
      { title: "BRUH Risk Disclosure — Crypto calls carry real losses" },
      {
        name: "description",
        content:
          "Risk disclosure for BRUH communities: token calls can go to zero, leaderboards are not advice, and every on-chain transfer is irreversible.",
      },
      { property: "og:title", content: "BRUH Risk Disclosure" },
      {
        property: "og:description",
        content: "The concrete risks of acting on calls, scores and tips inside a BRUH group.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RiskRoute,
});

function RiskRoute() {
  return (
    <PolicyPage
      title="Risk Disclosure"
      updated="February 2026"
      intro="Read this before acting on anything you see in a BRUH group. Trading tokens on Solana can and regularly does result in the total loss of the money you put in."
      sections={[
        {
          heading: "Tokens can go to zero",
          body: [
            "Most newly launched tokens lose most of their value. Liquidity can be pulled, mint authority can be abused, and a token that shows a 10x on a chart may be impossible to sell at any size. A high multiple in a leaderboard is not a realised profit.",
          ],
        },
        {
          heading: "Scores describe the past, not the future",
          body: [
            "BRUH Score is computed from recorded calls and public price data inside one group. A high-ranked caller has a good historical record in that group and nothing more. Treat rankings as community context, never as a signal to buy.",
          ],
        },
        {
          heading: "Data can be wrong or late",
          body: [
            "Prices come from third-party market feeds and are sampled periodically. Thin liquidity, wash trading and stale pools can distort them. BRUH quarantines calls that fail its liquidity checks, but no filter catches everything.",
          ],
        },
        {
          heading: "Transfers are irreversible",
          body: [
            "Tips are ordinary on-chain transfers approved in your own wallet. There is no chargeback, no support desk and no undo. Always check the address and amount your wallet shows you before signing.",
          ],
        },
        {
          heading: "Social risk",
          body: [
            "Groups can be coordinated against you. Someone who calls a token they already hold benefits when you buy it. Assume a conflict of interest exists unless you can verify otherwise.",
          ],
        },
        {
          heading: "Your responsibility",
          body: [
            "Only commit money you can afford to lose entirely, do your own research, and comply with the tax and financial regulations that apply where you live. BRUH is a record-keeping tool, not an adviser, broker or custodian.",
          ],
        },
      ]}
    />
  );
}
