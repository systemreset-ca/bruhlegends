import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, SectionLabel } from "@/components/site-chrome";
import { PARTICIPATION, PUBLIC_REPOSITORY } from "@/lib/participation";
import emblem from "@/assets/bruh-emblem.png.asset.json";

export const Route = createFileRoute("/token")({
  head: () => ({
    meta: [
      { title: "$BRUH — Product first. Community next. Token later." },
      {
        name: "description",
        content:
          "BRUH Legends grassroots roadmap: tipping, community participation and a future BRUH allocation. No presale. Earning has not started.",
      },
      { property: "og:title", content: "$BRUH — TIP A BRUH. BECOME A CHAD." },
      {
        property: "og:description",
        content:
          "The bot comes first. BRUH comes next. Follow real progress and the planned early-participation season.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/token" },
      { property: "og:image", content: emblem.url },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/token" }],
  }),
  component: TokenPage,
});

const stages = [
  {
    title: "Build the bot",
    status: "Live product",
    body: "Record calls, follow group rankings and build a transparent reputation inside Telegram.",
  },
  {
    title: "Build your record",
    status: "Planned — earning off",
    body: "A community season will recognize verified tips, sustained participation, legitimate calls and verified referrals. Tester recognition will be capped.",
  },
  {
    title: "Prepare BRUH",
    status: "Not finalized",
    body: "Publish the community pool, conversion and snapshot rules, canonical mint procedure, treasury separation and funded launch policy.",
  },
  {
    title: "Launch and use it",
    status: "Readiness gated",
    body: "Verify the mint, allocation distribution and liquidity on-chain before enabling wallet-authorized BRUH utility. No fixed launch date or automatic SOL-price trigger.",
  },
];

function TokenPage() {
  return (
    <SiteShell>
      <section className="arena-bg border-b border-border/70">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <SectionLabel>BRUH Legends · Solana · Community first</SectionLabel>
            <h1 className="mt-6 font-display text-6xl leading-tight text-gold-plate sm:text-7xl">
              TIP A BRUH.
              <br />
              BECOME A CHAD.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              The bot comes first. BRUH comes next. Make calls, recognize people and help build a
              community with a record everyone can inspect.
            </p>
            <div className="mt-8 rounded-xl border border-primary/50 bg-primary/10 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                BRUH not minted · No presale
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                There is no advance token sale or deposit address. The canonical mint will be
                published through official channels when approved. Do not send funds to anyone
                claiming to reserve BRUH for you.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                to="/app"
                className="rounded-md border border-border px-5 py-3 font-mono text-sm"
              >
                Open Mini App
              </Link>
            </div>
          </div>
          <img
            src={emblem.url}
            alt="BRUH Legends emblem"
            className="mx-auto w-full max-w-sm rounded-2xl border border-gold/30 plinth"
            width={1248}
            height={1248}
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionLabel>Early participation</SectionLabel>
        <h2 className="mt-4 font-display text-4xl">{PARTICIPATION.title}</h2>
        <p className="mt-5 max-w-3xl text-muted-foreground">{PARTICIPATION.description}</p>
        <p className="mt-5 max-w-3xl text-muted-foreground">{PARTICIPATION.disclosure}</p>
        <p className="mt-5 max-w-3xl text-primary">{PARTICIPATION.next}</p>
        <p className="mt-5 max-w-3xl text-sm text-muted-foreground">
          The proposed season rewards genuine participation, not endless self-tipping or
          faucet-funded volume. Use /credits or the Credits tab for the current status.
        </p>
      </section>

      <section className="border-y border-border/70 bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Roadmap</SectionLabel>
          <h2 className="mt-4 font-display text-4xl">Working product → community → BRUH</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {stages.map((stage) => (
              <li key={stage.title} className="rounded-xl border border-border bg-card p-6">
                <p className="font-mono text-xs uppercase text-primary">{stage.status}</p>
                <h3 className="mt-3 font-display text-xl">{stage.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{stage.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2">
        <article>
          <SectionLabel>Launch policy</SectionLabel>
          <h2 className="mt-4 font-display text-3xl">One mint. Verifiable actions.</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Supply, allocations, buy commitments, locks and initial liquidity are not finalized.
            BRUH/SOL is the primary liquidity candidate; USDC and CHAD pairs require separate
            funding and depth decisions. Planned locks are not completed locks.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Application fees remain off. Any future routing fee must be approved and disclosed
            before wallet authorization. CHAD and sponsored campaigns remain configurable proposals,
            with no automatic rewards enabled.
          </p>
        </article>
        <article>
          <SectionLabel>Build in the open</SectionLabel>
          <h2 className="mt-4 font-display text-3xl">Follow the evidence.</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            The project preserves revision history and records decisions, pull requests, tests and
            deployment evidence. Public access is being prepared; the repository may still require
            access. A merged change is not proof that it is live.
          </p>
          <a href={PUBLIC_REPOSITORY} className="mt-5 inline-block text-primary underline">
            Project GitHub repository
          </a>
        </article>
      </section>

      <section className="border-t border-border/70 bg-card/30">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="font-display text-3xl">Keep the culture. Keep control of your wallet.</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            BRUH never asks for the seed phrase of a wallet you already own. Your encrypted BRUH
            account wallet belongs to your Telegram account and follows you across groups, while
            every group's calls, rankings and reputation remain separate. Future token allocation
            and market value are not guaranteed. Never treat participation points as a spendable
            token balance.
          </p>

          <Link to="/risk" className="mt-5 inline-block text-primary underline">
            Risk disclosure
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
