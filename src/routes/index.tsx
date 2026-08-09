import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BRUH — Call tracking & non-custodial tipping for crypto groups" },
      {
        name: "description",
        content:
          "BRUH is a Telegram bot that records crypto calls with locked baselines, ranks callers per group, and lets communities tip on Solana without ever holding keys.",
      },
      { property: "og:title", content: "BRUH — Crypto community utility bot" },
      {
        property: "og:description",
        content:
          "Record calls, track real performance, reward the people who called them. Non-custodial, group-isolated, Solana-native.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    title: "Calls with locked baselines",
    body: "Every call snapshots price, market cap and liquidity at the moment it lands. No retroactive editing, no rewriting history.",
  },
  {
    title: "Group-isolated reputation",
    body: "BRUH Score ranks callers inside their own community. Nothing leaks across groups — not stats, not wallets, not identities.",
  },
  {
    title: "Non-custodial tipping",
    body: "Tips are Solana Pay requests you approve in your own wallet. BRUH never holds keys, never holds funds, and verifies every transfer on-chain.",
  },
  {
    title: "Milestones that fire once",
    body: "2x, 5x, 10x and beyond are announced exactly once per call, with quarantine rules so thin liquidity can't fake a run.",
  },
];

const commands = [
  ["/call <mint>", "Record a call with a locked baseline"],
  ["/leaderboard", "This group's BRUH Score ranking"],
  ["/stats", "Your own record here"],
  ["/tip 0.5 SOL", "Reply to someone to tip them"],
  ["/wallet", "Link a wallet privately, per group"],
  ["/privacy", "What's stored and how to opt out"],
];

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <header className="border-b border-border pb-14">
          <span className="inline-block rounded-full border border-primary/40 px-3 py-1 font-mono text-xs uppercase tracking-widest text-primary">
            Solana · Telegram · Non-custodial
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            BRUH keeps the receipts
            <span className="block text-primary">on every call your group makes.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            A Telegram utility bot for crypto communities: calls get an immutable baseline,
            performance gets tracked honestly, and the callers who earn it get tipped on Solana —
            without anyone handing over a key.
          </p>
        </header>

        <section className="grid gap-6 py-14 sm:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50"
            >
              <h2 className="text-lg font-semibold text-card-foreground">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="border-t border-border py-14">
          <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
            Command surface
          </h2>
          <dl className="mt-6 divide-y divide-border">
            {commands.map(([command, description]) => (
              <div key={command} className="flex flex-wrap gap-x-6 gap-y-1 py-3">
                <dt className="font-mono text-sm text-primary">{command}</dt>
                <dd className="text-sm text-muted-foreground">{description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="border-t border-border pt-8 text-sm text-muted-foreground">
          <p>
            BRUH never stores private keys or seed phrases. Tracking is informational only and is
            not financial advice.
          </p>
          <nav className="mt-4 flex gap-4 font-mono text-xs uppercase tracking-widest">
            <Link to="/privacy" className="hover:text-primary">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-primary">
              Terms
            </Link>
            <Link to="/risk" className="hover:text-primary">
              Risk
            </Link>
          </nav>
        </footer>

      </div>
    </main>
  );
}
