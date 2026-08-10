import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, SectionLabel, TELEGRAM_BOT_URL } from "@/components/site-chrome";

export const Route = createFileRoute("/groups")({
  head: () => ({
    meta: [
      { title: "For group admins — run BRUH Legends in your Telegram chat" },
      {
        name: "description",
        content:
          "Setup, moderation, seasons, announcement modes, quiet hours, exports and privacy controls for admins running the BRUH Legends bot.",
      },
      { property: "og:title", content: "BRUH Legends — admin playbook" },
      {
        property: "og:description",
        content:
          "Install in two minutes, then run your chat like a league: seasons, moderators, disputes, digests and exports.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/groups" },
    ],
    links: [{ rel: "canonical", href: "/groups" }],
  }),
  component: GroupsPage,
});

const setup = [
  {
    n: "01",
    title: "Add the bot",
    body: "Invite @BRUHLegendsBot to your group and give it permission to read messages and reply.",
  },
  {
    n: "02",
    title: "Run /bruh_setup",
    body: "A short wizard: detection mode, liquidity floor, announcement style and who counts as a moderator.",
  },
  {
    n: "03",
    title: "Open a season",
    body: "/season starts a fresh scoreboard without deleting any history. Old seasons stay browsable forever.",
  },
  {
    n: "04",
    title: "Tell the chat",
    body: "Pin /help. Members link a wallet with /wallet, and the first /call locks its baseline.",
  },
];

const controls = [
  {
    title: "Moderators & disputes",
    body: "/moderators manages who can act. /disputes lists flagged calls, and a moderator can uphold or reject each one. Invalidations create audit events — history is never destroyed.",
  },
  {
    title: "Announcement modes",
    body: "Instant, hourly digest or daily digest. Quiet hours hold milestones back and release them in a single batched message when the chat wakes up.",
  },
  {
    title: "Seasons",
    body: "Reset the leaderboard on your own cadence. Scores, calls and tips are all scoped to the active season, and past seasons remain queryable.",
  },
  {
    title: "Import & export",
    body: "Bring historical calls in as CSV — they're labelled 'imported' and excluded from BRUH Score. Export the group's full record any time.",
  },
  {
    title: "Privacy controls",
    body: "Tip receipts can be public, pseudonymous, anonymous-to-group or private. Members can request deletion; their data is anonymised, not silently kept.",
  },
  {
    title: "Pause switch",
    body: "/pause stops all processing and announcements immediately. /status shows provider health, queue depth and the last successful refresh.",
  },
];

const guarantees = [
  "No seed phrases, no private keys, no server-side signing",
  "Nothing crosses group boundaries — stats, wallets or identities",
  "Every price read is cross-checked between two providers",
  "Milestones fire once per call, with quarantine on thin liquidity",
  "Raw message retention is configurable, and deletion requests are honoured",
];

function GroupsPage() {
  return (
    <SiteShell>
      <section className="arena-bg border-b border-border/70">
        <div className="relative z-10 mx-auto max-w-4xl px-6 py-20 text-center">
          <SectionLabel>For group admins</SectionLabel>
          <h1 className="mt-6 font-display text-5xl leading-[0.95] sm:text-6xl">
            <span className="text-gold-plate">Run your chat</span>{" "}
            <span className="block text-lime-plate">like a league</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Two minutes to install, then the bot handles attribution, tracking, announcements and
            moderation while you get on with running the community.
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

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionLabel>Setup</SectionLabel>
        <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">Four steps</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-4">
          {setup.map((s) => (
            <li key={s.n} className="rounded-xl border border-border bg-card p-6">
              <span className="font-mono text-xs tracking-widest text-primary">{s.n}</span>
              <h3 className="mt-3 font-display text-lg tracking-wide">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-border/70 bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Controls</SectionLabel>
          <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
            Everything you'd expect to be able to change
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {controls.map((c) => (
              <article
                key={c.title}
                className="rounded-xl border border-border bg-background/60 p-6"
              >
                <div className="laurel-rule mb-5 w-12" />
                <h3 className="font-display text-xl tracking-wide">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2">
        <div>
          <SectionLabel>House rules</SectionLabel>
          <h2 className="mt-4 font-display text-4xl leading-tight">What we guarantee</h2>
          <ul className="mt-8 space-y-4">
            {guarantees.map((g) => (
              <li key={g} className="flex gap-3 text-sm text-muted-foreground">
                <span aria-hidden className="mt-1 font-mono text-primary">
                  ▸
                </span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-gold/30 bg-card p-8">
          <h2 className="font-display text-3xl leading-tight text-gold-plate">The Mini App</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Everything the bot does in chat also has a screen: a calls explorer with milestone
            timelines, member profiles with a BRUH Score breakdown, a tip composer, wallet linking
            and a full admin console with provider health and exports.
          </p>
          <Link
            to="/app"
            className="mt-6 inline-block rounded-md border border-primary/60 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
          >
            Open the Mini App
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
