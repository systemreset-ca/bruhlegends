import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, SectionLabel, TELEGRAM_BOT_URL } from "@/components/site-chrome";
import banner from "@/assets/bruh-banner.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BRUH Legends — Call tracking & Solana tipping for Telegram groups" },
      {
        name: "description",
        content:
          "The Telegram bot that locks a baseline on every call, ranks your callers honestly, and lets the group tip them on Solana. Non-custodial. Group-isolated.",
      },
      { property: "og:title", content: "BRUH Legends — Call it. Track it. Reward the legends." },
      {
        property: "og:description",
        content:
          "Locked call baselines, per-group leaderboards and non-custodial Solana tipping, inside Telegram.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { property: "og:image", content: banner.url },
      { name: "twitter:image", content: banner.url },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

const features = [
  {
    title: "Locked baselines",
    body: "Every call snapshots price, market cap and liquidity the second it lands. No retroactive editing, no rewriting history after the chart moves.",
  },
  {
    title: "Group-isolated reputation",
    body: "BRUH Score ranks callers inside their own chat. Nothing leaks across groups — not stats, not wallets, not identities.",
  },
  {
    title: "Test-network wallet beta",
    body: "BRUH is running a Solana devnet beta: a private chat with the bot creates one encrypted BRUH wallet for your Telegram account, shared across your groups. Creation and balance only — no spending, no key export, no retirement, and no real SOL. Tipping is switched off while this beta runs.",
  },

  {
    title: "Milestones that fire once",
    body: "2x, 5x, 10x, 100x announced exactly once per call, with quarantine rules so thin liquidity can't fake a run.",
  },
  {
    title: "Two price providers",
    body: "DexScreener and Jupiter are cross-checked on every read. When they disagree, the bot says so instead of inventing a number.",
  },
  {
    title: "Receipts, not vibes",
    body: "Seasons, disputes, moderator invalidations and CSV exports. Every change is an audit event, nothing is silently deleted.",
  },
];

const steps = [
  {
    n: "01",
    title: "Someone drops a contract",
    body: "/call <mint> in the group. The bot pulls the pair, price, market cap and liquidity and shows a preview card to confirm.",
  },
  {
    n: "02",
    title: "The baseline gets locked",
    body: "First valid caller wins attribution for that token, that group, that season. Later posts get an 'already called' reply.",
  },
  {
    n: "03",
    title: "The chart does what it does",
    body: "A worker refreshes prices, tracks ATH-since-call and drawdown, and announces each milestone once — respecting quiet hours.",
  },
  {
    n: "04",
    title: "The legend gets paid",
    body: "Tipping is turned off during the devnet wallet beta. When it returns, a tip is a request you approve in your own wallet and the bot verifies it on-chain.",
  },
];

const commands = [
  ["/call <mint>", "Record a call with a locked baseline"],
  ["/leaderboard 7d", "Group ranking — 7d, 30d or all time"],
  ["/stats", "Your own record in this group"],
  ["/calls", "Recent calls and where they stand"],
  ["/start", "Private chat — creates or reuses your devnet wallet"],
  ["/wallet make", "Private chat — confirm wallet creation"],
  ["/wallet show", "Private chat — address and live devnet balance"],
  ["/dispute", "Flag a call for moderator review"],
  ["/privacy", "What's stored, and how to be forgotten"],
];

const score = [
  ["40%", "Performance of the calls"],
  ["25%", "Consistency over time"],
  ["15%", "Early discovery"],
  ["15%", "Community recognition (capped)"],
  ["5%", "Reliability"],
];

const faq = [
  {
    q: "Does BRUH ever hold my funds?",
    a: "BRUH never asks for or stores the seed phrase of a wallet you already own. In the current Solana devnet beta, BRUH does generate one wallet for your Telegram account and keeps its key encrypted — so that specific wallet is not non-custodial. It exists on a test network only, holds no real value, and spending, key export and retirement are unavailable.",
  },
  {
    q: "Can someone see my stats in another group?",
    a: "No. Profiles, leaderboards and call records are keyed to a single chat. The generated devnet wallet is the one shared thing: it belongs to your Telegram account and is the same across every group you are in, while statistics stay separate per group.",
  },
  {
    q: "What stops a caller from spamming garbage tokens?",
    a: "Liquidity floors, first-valid-caller attribution, minimum-sample rules on the leaderboard, dispute handling and moderator invalidation.",
  },
  {
    q: "Is the $BRUH token required to use the bot?",
    a: "No. Call tracking, leaderboards and reputation do not require it. $BRUH is not minted yet, and nothing on this site is an offer to sell it.",
  },
];

function Landing() {
  return (
    <SiteShell>
      {/* Hero */}
      <section className="arena-bg overflow-hidden border-b border-border/70">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div className="relative z-10">
            <SectionLabel>Telegram · Solana · Non-custodial tipping</SectionLabel>
            <h1 className="mt-6 font-display text-6xl leading-[0.92] sm:text-7xl">
              <span className="text-gold-plate">Call it.</span>{" "}
              <span className="text-lime-plate">Track it.</span>
              <span className="block text-foreground">Reward the legends.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              BRUH Legends is the utility bot your group chat has been faking with screenshots. It
              locks a baseline on every call, keeps score for real, and lets the chat tip the
              callers who earned it — straight to their own wallet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-primary px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-primary-foreground glow-lime"
              >
                Add BRUH to your group
              </a>
              <Link
                to="/token"
                className="rounded-md border border-gold/50 px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-gold transition-colors hover:bg-gold/10"
              >
                The $BRUH token
              </Link>
            </div>
            <p className="mt-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              No seed phrases · Tips you sign yourself · No promises of profit
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-imperial/20 blur-3xl" aria-hidden />
            <img
              src={banner.url}
              alt="BRUH Legends — a laurel-crowned Solana champion above a golden arena"
              className="relative rounded-2xl border border-gold/30 plinth"
              width={1656}
              height={932}
            />
          </div>
        </div>
      </section>

      {/* Ticker strip */}
      <div className="border-b border-border/70 bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-2 px-6 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>Locked baselines</span>
          <span className="text-gold">·</span>
          <span>Per-group leaderboards</span>
          <span className="text-gold">·</span>
          <span>Solana Pay tips</span>
          <span className="text-gold">·</span>
          <span>Seasons &amp; disputes</span>
          <span className="text-gold">·</span>
          <span>Mini App</span>
        </div>
      </div>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionLabel>What it does</SectionLabel>
        <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
          Receipts for every call your chat has ever made
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/60"
            >
              <div className="laurel-rule mb-5 w-12" />
              <h3 className="font-display text-xl tracking-wide text-card-foreground">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How a call works */}
      <section className="border-y border-border/70 bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>How a call works</SectionLabel>
          <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
            From <span className="text-lime-plate">degen post</span> to{" "}
            <span className="text-gold-plate">paid legend</span>
          </h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="rounded-xl border border-border bg-background/60 p-6">
                <span className="font-mono text-xs tracking-widest text-primary">{s.n}</span>
                <h3 className="mt-3 font-display text-lg tracking-wide">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Commands + score */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SectionLabel>Commands</SectionLabel>
          <h2 className="mt-4 font-display text-4xl leading-tight">Everything runs in chat</h2>
          <div className="mt-8 overflow-hidden rounded-xl border border-border">
            {commands.map(([cmd, desc], i) => (
              <div
                key={cmd}
                className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 ${
                  i % 2 ? "bg-card/40" : "bg-card/70"
                }`}
              >
                <code className="font-mono text-sm text-primary">{cmd}</code>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>BRUH Score</SectionLabel>
          <h2 className="mt-4 font-display text-4xl leading-tight">Weighted, capped, honest</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            One number per member, per group, per season. Self-tips are excluded and tip influence
            is capped, so nobody buys their way up the board.
          </p>
          <div className="mt-8 space-y-3">
            {score.map(([pct, label]) => (
              <div key={label} className="flex items-center gap-4">
                <span className="w-12 shrink-0 text-right font-mono text-sm text-gold">{pct}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: pct }} />
                </div>
                <span className="w-44 shrink-0 text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Minimum 3 calls before a member is ranked
          </p>
        </div>
      </section>

      {/* Admin pitch */}
      <section className="border-y border-border/70 bg-card/30">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 px-6 py-16">
          <div className="max-w-xl">
            <SectionLabel>Group admins</SectionLabel>
            <h2 className="mt-4 font-display text-4xl leading-tight">
              Run your chat like a league
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Seasons, moderators, dispute resolution, announcement modes, quiet hours, CSV import
              and export, and a pause switch. Set it up in a couple of minutes.
            </p>
          </div>
          <Link
            to="/groups"
            className="rounded-md border border-primary/60 px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
          >
            Admin playbook
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionLabel>FAQ</SectionLabel>
        <h2 className="mt-4 font-display text-4xl leading-tight">Straight answers</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {faq.map((item) => (
            <article key={item.q} className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-display text-lg tracking-wide">{item.q}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="arena-bg border-t border-border/70">
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="font-display text-5xl leading-tight sm:text-6xl text-gold-plate">
            Crown your callers
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Add the bot, run <code className="font-mono text-primary">/bruh_setup</code>, and the
            next call your chat makes is on the record forever.
          </p>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-block rounded-md bg-primary px-8 py-4 font-mono text-sm font-bold uppercase tracking-widest text-primary-foreground glow-lime"
          >
            Add BRUH to your group
          </a>
        </div>
      </section>
    </SiteShell>
  );
}
