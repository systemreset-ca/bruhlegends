import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteShell, SectionLabel } from "@/components/site-chrome";

function FlowFrame() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1600);

  useEffect(() => {
    const measure = () => {
      const doc = ref.current?.contentDocument;
      if (!doc) return;
      const h = Math.max(
        doc.body?.scrollHeight ?? 0,
        doc.documentElement?.scrollHeight ?? 0,
      );
      if (h > 0) setHeight(h);
    };
    const id = window.setInterval(measure, 500);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <iframe
      ref={ref}
      src="/tiptek-flow.html"
      title="BRUH TipTek on-chain tip flow diagram"
      scrolling="no"
      style={{ height }}
      className="w-full border-0 overflow-hidden"
    />
  );
}


export const Route = createFileRoute("/tiptek")({
  head: () => ({
    meta: [
      { title: "TipTek — How BRUH on-chain tips actually work" },
      {
        name: "description",
        content:
          "TipTek: the full wallet-to-wallet flow of a BRUH tip on Solana — intent, Solana Pay, signing, on-chain verification and the 1% service fee.",
      },
      { property: "og:title", content: "TipTek — BRUH on-chain tip flow" },
      {
        property: "og:description",
        content:
          "A technical, step-by-step diagram of how a BRUH tip travels wallet to wallet on Solana, verified on-chain.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TipTekPage,
});

function TipTekPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-6 pt-12">
        <SectionLabel>TipTek</SectionLabel>
        <h1 className="mt-4 font-display text-4xl uppercase tracking-wide text-gold-plate sm:text-5xl">
          Wallet to wallet, on chain
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          The exact path a tip takes: intent created in the bot, Solana Pay handed to your wallet,
          you sign, and the transfer is verified against the chain by reference key. The bot never
          touches your keys or your funds.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/tiptek-flow.html"
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-primary-foreground transition-shadow hover:glow-lime"
          >
            Open full diagram
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/40">
          <FlowFrame />
        </div>
      </section>

    </SiteShell>
  );
}
