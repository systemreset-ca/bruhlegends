/** Public launch state. No earning switch exists until the durable ledger is implemented. */
export const PARTICIPATION = {
  status: "planned",
  earningEnabled: false,
  title: "Early participation — earning has not started",
  description:
    "The planned community season will recognize verified tips, sustained activity, legitimate calls and verified group referrals. Genuine devnet testers may receive a capped tester bonus under published rules.",
  disclosure:
    "Participation points are not BRUH tokens, a wallet balance or a fixed token entitlement. The community pool and conversion rules must be published before the final allocation snapshot.",
  next: "Earning starts only after the ledger, farming controls and approved season rules are ready. No points are being awarded by this release.",
} as const;

export const PUBLIC_REPOSITORY = "https://github.com/systemreset-ca/bruhlegends";

export function creditsMessage(): string {
  return [
    PARTICIPATION.title,
    PARTICIPATION.description,
    PARTICIPATION.disclosure,
    PARTICIPATION.next,
  ].join("\n\n");
}
