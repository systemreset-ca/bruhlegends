import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Check, Copy, Download, ImageDown, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SiteShell, SectionLabel } from "@/components/site-chrome";
import {
  BRAND_COLORS,
  BRAND_PALETTE,
  BRAND_TYPOGRAPHY,
  COPY_BLOCKS,
  TAGLINES,
  VOICE_RULES,
} from "@/lib/brand";
import {
  LOGO_VARIANTS,
  MarkLaurelCoin,
  Wordmark,
  type LogoVariant,
} from "@/components/brand/logos";
import {
  BANNER_PRESETS,
  bannerToPng,
  markToPng,
  serializeSvg,
  triggerDownload,
  type BannerStyle,
} from "@/lib/brandExport";

export const Route = createFileRoute("/brand")({
  head: () => ({
    meta: [
      { title: "Brand kit & content studio — BRUH Legends" },
      {
        name: "description",
        content:
          "Internal brand workspace for BRUH Legends: Colosseum Degen palette, Anton/Space Grotesk type, logo marks, banner exports and approved copy blocks.",
      },
      { property: "og:title", content: "BRUH Legends — brand kit & content studio" },
      {
        property: "og:description",
        content:
          "Marks, palette, typography, voice rules and ready-to-paste copy for BRUH Legends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BrandPage,
});

const PNG_SIZES = [256, 512, 1024];

function downloadSvg(name: string, svg: SVGSVGElement) {
  triggerDownload(name, new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" }));
}

function LogoCard({ variant, light }: { variant: LogoVariant; light: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { Mark, stacked } = variant;
  const getSvg = () => ref.current?.querySelector("svg") as SVGSVGElement | null;

  const handleSvg = () => {
    const svg = getSvg();
    if (!svg) return;
    downloadSvg(`bruh-legends-${variant.id}.svg`, svg);
    toast.success(`${variant.name} downloaded as SVG`);
  };

  const handlePng = async (size: number, transparent: boolean) => {
    const svg = getSvg();
    if (!svg) return;
    try {
      const blob = await markToPng(svg, size, transparent ? null : BRAND_COLORS.obsidian);
      triggerDownload(
        `bruh-legends-${variant.id}-${size}${transparent ? "-transparent" : ""}.png`,
        blob,
      );
      toast.success(`PNG ${size}px${transparent ? " (transparent)" : ""} downloaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PNG export failed");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div
        ref={ref}
        className="flex min-h-[220px] items-center justify-center px-8 py-12"
        style={{ backgroundColor: light ? BRAND_COLORS.bone : BRAND_COLORS.obsidian }}
      >
        <div className={stacked ? "flex flex-col items-center gap-4" : "flex items-center gap-4"}>
          <Mark size={stacked ? 92 : 68} inverse={!light} />
          <Wordmark inverse={!light} className={stacked ? "text-2xl" : "text-3xl"} />
        </div>
      </div>

      <div className="space-y-3 border-t border-border p-6">
        <h3 className="font-display text-lg tracking-wide">{variant.name}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{variant.story}</p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-gold">
          {variant.bestFor}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleSvg}>
            <Download className="mr-2 h-4 w-4" />
            SVG
          </Button>
          {PNG_SIZES.map((s) => (
            <Button key={s} variant="ghost" size="sm" onClick={() => handlePng(s, false)}>
              PNG {s}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => handlePng(1024, true)}>
            <ImageDown className="mr-2 h-4 w-4" />
            Transparent
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChosenIdentity() {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<BannerStyle>("arena");
  const [tagline, setTagline] = useState<string>(TAGLINES[0] ?? "");
  const getSvg = () => ref.current?.querySelector("svg") as SVGSVGElement | null;

  const background =
    style === "arena"
      ? `linear-gradient(100deg, ${BRAND_COLORS.obsidian}, ${BRAND_COLORS.imperial} 55%, ${BRAND_COLORS.gold})`
      : style === "obsidian"
        ? BRAND_COLORS.obsidian
        : BRAND_COLORS.bone;

  const exportMark = async (size: number, transparent: boolean) => {
    const svg = getSvg();
    if (!svg) return;
    try {
      const bg = transparent
        ? null
        : style === "arena"
          ? "arena"
          : style === "obsidian"
            ? BRAND_COLORS.obsidian
            : BRAND_COLORS.bone;
      const blob = await markToPng(svg, size, bg);
      triggerDownload(
        `bruh-legends-mark-${style}-${size}${transparent ? "-transparent" : ""}.png`,
        blob,
      );
      toast.success(`Mark PNG ${size}px ${style}${transparent ? " (transparent)" : ""} downloaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PNG export failed");
    }
  };

  const exportBanner = async (presetId: string) => {
    const svg = getSvg();
    const preset = BANNER_PRESETS.find((p) => p.id === presetId);
    if (!svg || !preset) return;
    try {
      const blob = await bannerToPng(svg, preset, style, tagline);
      triggerDownload(
        `bruh-legends-banner-${preset.id}-${preset.width}x${preset.height}-${style}.png`,
        blob,
      );
      toast.success(`${preset.label} ${preset.width}×${preset.height} downloaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Banner export failed");
    }
  };

  return (
    <section className="mt-12 overflow-hidden rounded-2xl border border-gold/40 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gold/5 px-6 py-4">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-gold" />
          <h2 className="font-display text-xl tracking-wide">Primary identity — 01 Laurel Coin</h2>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-gold">
          Locked. Export below.
        </span>
      </div>

      <div className="grid md:grid-cols-2">
        <div
          ref={ref}
          className="flex flex-col items-center justify-center gap-5 px-8 py-14"
          style={{ background }}
        >
          <MarkLaurelCoin size={130} inverse={style !== "bone"} />
          <Wordmark inverse={style !== "bone"} className="text-3xl" />
          {tagline ? (
            <p
              className="text-center text-sm"
              style={{
                color: style === "bone" ? BRAND_COLORS.obsidian : BRAND_COLORS.bone,
                opacity: 0.85,
              }}
            >
              {tagline}
            </p>
          ) : null}
        </div>

        <div className="space-y-6 p-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Background
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["arena", "obsidian", "bone"] as BannerStyle[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={style === s ? "default" : "outline"}
                  onClick={() => setStyle(s)}
                  className="capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Tagline
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TAGLINES.map((t, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={tagline === t ? "default" : "outline"}
                  onClick={() => setTagline(t)}
                >
                  {t === "" ? "No tagline" : t}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Mark files
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const svg = getSvg();
                  if (svg) {
                    downloadSvg("bruh-legends-mark.svg", svg);
                    toast.success("Mark downloaded as SVG");
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                SVG
              </Button>
              {PNG_SIZES.map((s) => (
                <Button key={s} size="sm" variant="ghost" onClick={() => exportMark(s, false)}>
                  PNG {s}
                </Button>
              ))}
              {[512, 1024].map((s) => (
                <Button key={`t${s}`} size="sm" variant="ghost" onClick={() => exportMark(s, true)}>
                  <ImageDown className="mr-2 h-4 w-4" />
                  {s} transparent
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Banners
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {BANNER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => exportBanner(p.id)}
                  className="rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span className="block text-sm font-medium">{p.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {p.width}×{p.height}
                  </span>
                  <span className="block pt-1 text-xs text-muted-foreground">{p.note}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Banners render with the background and tagline selected above.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Swatch({ name, hex, token, role }: (typeof BRAND_PALETTE)[number]) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(hex);
    setCopied(true);
    toast.success(`${hex} copied`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-primary/60"
    >
      <div className="h-24 w-full" style={{ backgroundColor: hex }} />
      <div className="space-y-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{name}</span>
          {copied ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <p className="font-mono text-xs uppercase text-muted-foreground">{hex}</p>
        <p className="font-mono text-xs text-muted-foreground">{token}</p>
        <p className="pt-1 text-xs text-muted-foreground">{role}</p>
      </div>
    </button>
  );
}

function CopyBlock({ block }: { block: (typeof COPY_BLOCKS)[number] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(block.text);
    setCopied(true);
    toast.success(`${block.label} copied`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg tracking-wide">{block.label}</h3>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {block.note}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {block.text}
      </p>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">
        {block.text.length} chars
      </p>
    </article>
  );
}

function BrandPage() {
  const [light, setLight] = useState(false);

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="max-w-3xl">
          <SectionLabel>Internal · brand studio</SectionLabel>
          <h1 className="mt-6 font-display text-5xl leading-[0.95] sm:text-6xl">
            <span className="text-gold-plate">Colosseum Degen</span>
            <span className="block text-foreground">brand kit &amp; content studio</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Everything needed to produce on-brand BRUH Legends content: the locked mark, the four
            logo directions, palette, type, voice rules and approved copy blocks. Marks export as
            SVG, PNG, transparent PNG and ready-made banners.
          </p>
        </header>

        <ChosenIdentity />

        <section className="mt-20">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-3xl tracking-wide">Logo directions</h2>
            <Button variant="secondary" size="sm" onClick={() => setLight((d) => !d)}>
              {light ? "Show on obsidian" : "Show on bone"}
            </Button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {LOGO_VARIANTS.map((v) => (
              <LogoCard key={v.id} variant={v} light={light} />
            ))}
          </div>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-3xl tracking-wide">Colour — Colosseum Degen</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Obsidian is the floor, gold is the crown, lime is the win, purple is the arena. Click a
            swatch to copy the hex. Tokens in{" "}
            <code className="font-mono text-primary">styles.css</code> stay authoritative for app
            UI.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BRAND_PALETTE.map((c) => (
              <Swatch key={c.hex} {...c} />
            ))}
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-border">
            <div
              className="flex h-24 items-center justify-center font-display text-xl tracking-wide"
              style={{
                background: `linear-gradient(100deg, ${BRAND_COLORS.obsidian}, ${BRAND_COLORS.imperial} 55%, ${BRAND_COLORS.gold})`,
                color: BRAND_COLORS.bone,
              }}
            >
              Signature gradient — arena at dusk
            </div>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-3xl tracking-wide">Typography</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {BRAND_TYPOGRAPHY.map((f) => (
              <div key={f.name} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl tracking-wide">{f.name}</h3>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {f.role}
                  </span>
                </div>
                <p className="mt-4 text-2xl leading-tight" style={{ fontFamily: f.stack }}>
                  {f.sample}
                </p>
                <p className="mt-4 text-sm text-muted-foreground">{f.notes}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-3xl tracking-wide">Voice &amp; claims</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-6">
              <h3 className="font-display text-lg tracking-wide text-primary">Do</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {VOICE_RULES.do.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
              <h3 className="font-display text-lg tracking-wide text-destructive">Don't</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {VOICE_RULES.dont.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-3xl tracking-wide">Copy blocks</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Approved, compliance-checked wording. Copy straight into BotFather, X, Telegram or a
            listing form.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {COPY_BLOCKS.map((b) => (
              <CopyBlock key={b.id} block={b} />
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-border bg-card/50 p-8">
          <h2 className="font-display text-3xl tracking-wide">Favicon &amp; avatar set</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            How each mark holds up small — 64px, 32px and 16px. Pick one and it gets wired into the
            header, favicon and social cards site-wide.
          </p>
          <div className="mt-6 flex flex-wrap gap-8">
            {LOGO_VARIANTS.map(({ id, Mark }) => (
              <div key={id} className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-background">
                  <Mark size={44} inverse />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
                  <Mark size={22} inverse />
                </div>
                <Mark size={16} inverse />
              </div>
            ))}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
