import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, SectionLabel } from "@/components/site-chrome";
import emblem from "@/assets/bruh-emblem.png.asset.json";

export const Route = createFileRoute("/token")({
  head: () => ({
    meta: [
      { title: "$BRUH — The Bruh Legends token (not minted yet)" },
      {
        name: "description",
        content:
          "What $BRUH is, how it plugs into the Bruh Legends tipping bot, the 1% service fee, the planned mint parameters and the launch order. Not minted, not for sale.",
      },
      { property: "og:title", content: "$BRUH — The Bruh Legends token" },
      {
        property: "og:description",
        content:
          "A plain SPL token built to be the tipping asset inside the Bruh Legends Telegram bot. Mint parameters, fee model and launch plan.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/token" },
      { property: "og:image", content: emblem.url },
      { name: "twitter:image", content: emblem.url },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/token" }],
  }),
  component: TokenPage,
});

const mintFacts = [
  ["Program", "SPL Token (not Token-2022)"],
  ["Decimals", "6"],
  ["Supply", "Fixed at mint"],
  ["Mint authority", "Revoked after mint"],
  ["Freeze authority", "Revoked (never set)"],
  ["Transfer tax", "None — zero at the token level"],
  ["Pool", "Raydium CPMM, 0.25% fee tier"],
  ["Liquidity", "Locked at launch"],
];

const utility = [
  {
    title: "The default tipping asset",
    body: "Reply-tip a caller in $BRUH the same way you tip SOL or USDC today. The bot resolves the recipient's group wallet, builds the request, and verifies the transfer on-chain.",
  },
  {
    title: "One mint, no spoofs",
    body: "The app trusts exactly one $BRUH mint from server config. A copycat token with the same name and ticker simply will not resolve.",
  },
  {
    title: "Leaderboard recognition",
    body: "Tips feed the community-recognition slice of BRUH Score — capped, and with self-tips excluded, so it's recognition rather than a purchase.",
  },
  {
    title: "Season prize pools",
    body: "Admins can run a season and settle it in $BRUH, entirely non-custodially: the bot builds the requests, humans sign them.",
  },
];

const feeRows = [
  ["Buy leg", "$10.00", "$0.10", "$9.90 of $BRUH reaches the tip"],
  ["Cash-out leg", "$9.90", "$0.099", "$9.80 lands back as SOL"],
  ["Round trip", "$10.00", "$0.199", "≈2% total across both legs"],
];

const roadmap = [
  {
    phase: "Now",
    title: "Bot live, token off",
    body: "Calls, leaderboards, seasons, disputes and tipping in SOL and USDC are shipped. $BRUH sits in the asset registry, disabled.",
  },
  {
    phase: "Next",
    title: "Mint & pool",
    body: "Mint the SPL token with fixed supply, revoke authorities, seed a Raydium CPMM pool and lock the liquidity.",
  },
  {
    phase: "Then",
    title: "Flip the flag",
    body: "The mint address goes into server config, the registry row is enabled, and quote-locked $BRUH tipping turns on in the bot and Mini App.",
  },
  {
    phase: "After",
    title: "Season one",
    body: "First public Bruh Legends season across partner groups, with the leaderboard and receipts everyone can audit.",
  },
];

function TokenPage() {
  return (
    <SiteShell>
      <section className="arena-bg border-b border-border/70">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_0.8fr]">
          <div className="relative z-10">
            <SectionLabel>Bruh Legends · Solana · SPL</SectionLabel>
            <h1 className="mt-6 font-display text-6xl leading-[0.95] sm:text-7xl text-gold-plate">
              $BRUH
            </h1>
            <p className="mt-4 font-display text-2xl tracking-wide text-lime-plate">
              The tipping currency of the arena
            </p>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              A plain, boring, honest SPL token with one job: being the thing your group tips its
              best callers with. No transfer tax baked into the mint, no hooks, no hidden
              authorities.
            </p>
            <div className="mt-8 rounded-xl border border-destructive/50 bg-destructive/10 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-destructive">
                Status: not minted
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                $BRUH does not exist on-chain yet. Nothing here is an offer to sell a token, there
                is no presale, and any contract address claiming to be $BRUH today is fake. The
                official mint will be published here and pinned in the bot.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-gold/15 blur-3xl" aria-hidden />
            <img
              src={emblem.url}
              alt="Bruh Legends emblem: a laurel-crowned figure over a Solana mark"
              className="relative mx-auto w-full max-w-sm rounded-2xl border border-gold/30 plinth"
              width={1248}
              height={1248}
            />
          </div>
        </div>
      </section>

      {/* Utility */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionLabel>Utility</SectionLabel>
        <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
          What the token actually does
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {utility.map((u) => (
            <article key={u.title} className="rounded-xl border border-border bg-card p-6">
              <div className="laurel-rule mb-5 w-12" />
              <h3 className="font-display text-xl tracking-wide">{u.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{u.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
          Holding $BRUH is not a yield product. There is no staking, no rewards for holding and no
          revenue share. It is a tipping and recognition asset inside a chat bot.
        </p>
      </section>

      {/* Mint parameters */}
      <section className="border-y border-border/70 bg-card/30">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2">
          <div>
            <SectionLabel>Planned mint</SectionLabel>
            <h2 className="mt-4 font-display text-4xl leading-tight">Parameters, locked in</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              These decisions are already committed and drive how the bot is built. Standard SPL
              keeps $BRUH compatible with every Solana wallet, DEX and aggregator without the
              integration landmines a Token-2022 transfer fee introduces.
            </p>
            <div className="mt-8 overflow-hidden rounded-xl border border-border">
              {mintFacts.map(([k, v], i) => (
                <div
                  key={k}
                  className={`flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 ${
                    i % 2 ? "bg-background/40" : "bg-background/70"
                  }`}
                >
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {k}
                  </span>
                  <span className="font-mono text-sm text-gold">{v}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Total supply, allocation and initial liquidity are published at launch. No numbers are
              invented before they are real.
            </p>
          </div>

          <div>
            <SectionLabel>Service fee</SectionLabel>
            <h2 className="mt-4 font-display text-4xl leading-tight">1% in, 1% out</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The fee lives in the app, not in the token. Wallet-to-wallet transfers of $BRUH are
              never taxed. A 1% service fee is taken only when the bot helps you acquire $BRUH for a
              tip, and again when a recipient cashes out through the bot. Every fee leg is written
              to an on-chain-verified ledger you can audit.
            </p>
            <div className="mt-8 overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr] gap-2 bg-card px-5 py-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <span>Leg</span>
                <span>Amount</span>
                <span>Fee</span>
              </div>
              {feeRows.map(([leg, amount, fee, note], i) => (
                <div
                  key={leg}
                  className={`px-5 py-3 ${i % 2 ? "bg-background/40" : "bg-background/70"}`}
                >
                  <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr] gap-2 text-sm">
                    <span>{leg}</span>
                    <span className="font-mono text-muted-foreground">{amount}</span>
                    <span className="font-mono text-primary">{fee}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{note}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Rounding always favours the user. Network fees and DEX pool fees are separate and paid
              to Solana and the pool, not to us. See the{" "}
              <Link to="/terms" className="text-primary hover:underline">
                Terms
              </Link>{" "}
              for the full disclosure.
            </p>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionLabel>Launch order</SectionLabel>
        <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
          Bot first, token second
        </h2>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          The utility ships before the asset. By the time $BRUH exists, the thing it is used for is
          already running in real groups.
        </p>
        <ol className="mt-10 grid gap-5 md:grid-cols-4">
          {roadmap.map((r) => (
            <li key={r.phase} className="rounded-xl border border-border bg-card p-6">
              <span className="font-mono text-xs uppercase tracking-widest text-primary">
                {r.phase}
              </span>
              <h3 className="mt-3 font-display text-lg tracking-wide">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Risk */}
      <section className="border-t border-border/70 bg-card/30">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <SectionLabel>Read this part</SectionLabel>
          <h2 className="mt-4 font-display text-4xl leading-tight">
            Tokens can go to zero. Including this one.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            $BRUH is a utility and recognition token for a chat bot, not an investment product. No
            returns are promised or implied, on-chain transfers are public and irreversible, and you
            are responsible for verifying every address you send to.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/risk"
              className="rounded-md border border-destructive/50 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-destructive transition-colors hover:bg-destructive/10"
            >
              Risk disclosure
            </Link>
            <Link
              to="/terms"
              className="rounded-md border border-border px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
            >
              Terms of use
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
