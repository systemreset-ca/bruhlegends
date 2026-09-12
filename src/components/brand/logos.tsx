import type { ReactElement } from "react";

import { BRAND_COLORS as C } from "@/lib/brand";

export type LogoProps = {
  /** Rendered size in px (square canvas). */
  size?: number;
  /** true = light artwork for dark backgrounds. */
  inverse?: boolean;
  className?: string;
};

const ink = (inverse?: boolean) => (inverse ? C.bone : C.obsidian);

/* ------------------------------------------------------------------ */
/* 1. Laurel Coin — the champion's wreath struck into a coin. The      */
/*    default identity: reputation, minted.                            */
/* ------------------------------------------------------------------ */
export function MarkLaurelCoin({ size = 64, inverse, className }: LogoProps) {
  const leaves = [-46, -24, -2, 20, 42];
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Laurel Coin mark"
    >
      <circle cx="32" cy="32" r="30" fill={inverse ? C.obsidian : C.bone} />
      <circle cx="32" cy="32" r="30" fill="none" stroke={C.gold} strokeWidth="3" />
      {[-1, 1].map((side) =>
        leaves.map((deg) => (
          <ellipse
            key={`${side}-${deg}`}
            cx={32 + side * 25.5}
            cy={32}
            rx="4.6"
            ry="2.4"
            fill={C.gold}
            opacity={0.9}
            transform={`rotate(${deg} 32 32) rotate(${side * 32} ${32 + side * 25.5} 32)`}
          />
        )),
      )}
      <path
        d="M18 42 L28 32 L35 38 L47 22"
        fill="none"
        stroke={C.lime}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M39 22 L47 22 L47 30"
        fill="none"
        stroke={C.lime}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Up-Only Chevron — three ascending bars under a spearhead.        */
/* ------------------------------------------------------------------ */
export function MarkUpOnly({ size = 64, inverse, className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Up Only mark"
    >
      <rect x="8" y="42" width="10" height="14" rx="2" fill={C.imperial} />
      <rect x="22" y="32" width="10" height="24" rx="2" fill={C.imperial} opacity="0.8" />
      <rect x="36" y="22" width="10" height="34" rx="2" fill={C.gold} />
      <path d="M50 10 L60 26 L40 26 Z" fill={C.lime} />
      <path
        d="M6 60 L58 60"
        stroke={ink(inverse)}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Winged Sigil — imperial wings around a lime "B" plinth.          */
/* ------------------------------------------------------------------ */
export function MarkWingedSigil({ size = 64, inverse, className }: LogoProps) {
  const wing = (flip: boolean) => (
    <g transform={flip ? "translate(64,0) scale(-1,1)" : undefined}>
      <path d="M4 24 L22 30 L4 34 Z" fill={C.imperial} />
      <path d="M6 34 L22 38 L7 42 Z" fill={C.imperial} opacity="0.75" />
      <path d="M9 43 L22 46 L10 50 Z" fill={C.imperial} opacity="0.5" />
    </g>
  );
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Winged Sigil mark"
    >
      {wing(false)}
      {wing(true)}
      <rect x="24" y="16" width="16" height="34" rx="4" fill={C.lime} />
      <path d="M28 24 h6 a4 4 0 0 1 0 8 h-6 Z" fill={C.obsidian} />
      <path d="M28 34 h7 a4 4 0 0 1 0 8 h-7 Z" fill={C.obsidian} />
      <path d="M22 54 L42 54" stroke={C.gold} strokeWidth="4" strokeLinecap="round" />
      <path
        d="M18 60 L46 60"
        stroke={ink(inverse)}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Arena Shield — the group as a closed arena, chart inside.        */
/* ------------------------------------------------------------------ */
export function MarkArenaShield({ size = 64, inverse, className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Arena Shield mark"
    >
      <path d="M32 4 L56 12 V32 C56 46 45 56 32 60 C19 56 8 46 8 32 V12 Z" fill={C.imperial} />
      <path
        d="M32 9 L51 15.5 V32 C51 43.5 42 51.8 32 55.2 C22 51.8 13 43.5 13 32 V15.5 Z"
        fill={inverse ? C.obsidian : C.bone}
      />
      <path
        d="M19 40 L27 31 L33 36 L45 21"
        fill="none"
        stroke={C.lime}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="45" cy="21" r="4" fill={C.gold} />
    </svg>
  );
}

export type LogoVariant = {
  id: string;
  name: string;
  story: string;
  bestFor: string;
  stacked: boolean;
  Mark: (props: LogoProps) => ReactElement;
};

export const LOGO_VARIANTS: LogoVariant[] = [
  {
    id: "laurel-coin",
    name: "01 Laurel Coin",
    story:
      "A gold laurel wreath struck into a coin with an acid-lime breakout inside. Reputation, minted.",
    bestFor: "Primary mark · avatar · favicon",
    stacked: false,
    Mark: MarkLaurelCoin,
  },
  {
    id: "up-only",
    name: "02 Up Only",
    story: "Three ascending bars under a lime spearhead. Pure chart language, reads at 16px.",
    bestFor: "Charts, milestone stickers, loading states",
    stacked: false,
    Mark: MarkUpOnly,
  },
  {
    id: "winged-sigil",
    name: "03 Winged Sigil",
    story:
      "Imperial wings flanking a lime plinth carrying the BRUH B. Straight from the banner artwork.",
    bestFor: "Merch, hero lockups, sticker packs",
    stacked: true,
    Mark: MarkWingedSigil,
  },
  {
    id: "arena-shield",
    name: "04 Arena Shield",
    story: "The group as a sealed arena — nothing leaks across chats. Chart runs inside the walls.",
    bestFor: "Trust / security surfaces, group admin material",
    stacked: false,
    Mark: MarkArenaShield,
  },
];

export function Wordmark({ inverse, className }: { inverse?: boolean; className?: string }) {
  return (
    <span
      className={`font-display leading-none tracking-wide ${className ?? ""}`}
      style={{ color: inverse ? C.bone : C.obsidian }}
    >
      <span style={{ color: inverse ? C.lime : C.imperial }}>BRUH</span> LEGENDS
    </span>
  );
}
