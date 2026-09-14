import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import emblem from "@/assets/bruh-emblem.png.asset.json";

export const TELEGRAM_BOT_URL = "https://t.me/BRUHLegendsBot";

const nav = [
  { to: "/", label: "The Bot" },
  { to: "/groups", label: "For Admins" },
  { to: "/tiptek", label: "TipTek" },
  { to: "/token", label: "$BRUH" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link to="/" className="flex items-center gap-3">
          <img src={emblem.url} alt="BRUH Legends emblem" className="h-9 w-9 rounded-md" />
          <span className="font-display text-xl leading-none tracking-wide text-gold-plate">
            BRUH Legends
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-6 font-mono text-xs uppercase tracking-widest text-muted-foreground sm:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "text-primary" }}
              className="transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <a
          href={TELEGRAM_BOT_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto rounded-md bg-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-primary-foreground transition-shadow hover:glow-lime sm:ml-0"
        >
          Add to group
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/40">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-center gap-4">
          <img src={emblem.url} alt="" aria-hidden className="h-10 w-10 rounded-md opacity-90" />
          <p className="max-w-md text-sm text-muted-foreground">
            BRUH Legends is a utility bot and never promises returns. It never asks for the seed
            phrase of a wallet you already own. It is currently in a Solana devnet beta that
            generates one encrypted test wallet per Telegram account — creation and balance only, no
            spending, no key export, no retirement, no real funds. Tipping is switched off.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <Link to="/" className="hover:text-primary">
            The Bot
          </Link>
          <Link to="/groups" className="hover:text-primary">
            For Admins
          </Link>
          <Link to="/token" className="hover:text-primary">
            $BRUH
          </Link>
          <Link to="/tiptek" className="hover:text-primary">
            TipTek
          </Link>
          <Link to="/app" className="hover:text-primary">
            Mini App
          </Link>
          <Link to="/privacy" className="hover:text-primary">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-primary">
            Terms
          </Link>
          <Link to="/risk" className="hover:text-primary">
            Risk
          </Link>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-primary"
          >
            Telegram
          </a>
        </div>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">
          bruh.tips · bruh-legends.xyz · Solana · Non-custodial tipping
        </p>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-gold/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-gold">
      {children}
    </span>
  );
}
