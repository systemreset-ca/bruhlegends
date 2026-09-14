// Brand constants for the internal /brand asset library.
//
// These literal hex values are the *exported* form of the oklch design tokens
// in src/styles.css (which stay authoritative for the app UI). They exist here
// so downloadable SVG/PNG assets carry real colour values instead of tokens.

export const BRAND_COLORS = {
  lime: "#C4F42B",
  gold: "#E5B33C",
  imperial: "#7B2FE0",
  obsidian: "#111017",
  bone: "#F6F3E8",
  ember: "#E04A33",
} as const;

export type BrandColorName = keyof typeof BRAND_COLORS;

export const BRAND_PALETTE: Array<{
  name: string;
  hex: string;
  token: string;
  role: string;
}> = [
  {
    name: "Acid Lime",
    hex: BRAND_COLORS.lime,
    token: "--primary",
    role: "Primary. CTAs, up-only charts, live numbers.",
  },
  {
    name: "Molten Gold",
    hex: BRAND_COLORS.gold,
    token: "--gold / --accent",
    role: "Accent. Laurels, medals, headline plating.",
  },
  {
    name: "Imperial Purple",
    hex: BRAND_COLORS.imperial,
    token: "--imperial",
    role: "Secondary. Badges, glows, arena backdrop.",
  },
  {
    name: "Obsidian",
    hex: BRAND_COLORS.obsidian,
    token: "--background",
    role: "The arena floor. Default background everywhere.",
  },
  {
    name: "Bone",
    hex: BRAND_COLORS.bone,
    token: "--foreground",
    role: "Text on obsidian, light lockups.",
  },
  {
    name: "Ember",
    hex: BRAND_COLORS.ember,
    token: "--destructive",
    role: "Risk copy, drawdowns, invalidated calls.",
  },
];

export const BRAND_TYPOGRAPHY = [
  {
    name: "Anton",
    role: "Display / headlines & wordmark",
    stack: "var(--font-display)",
    sample: "CALL IT. TRACK IT.",
    notes: "Heavy condensed. Uppercase, tight leading (0.92), wide-ish tracking on short lines.",
  },
  {
    name: "Space Grotesk",
    role: "Body / UI",
    stack: "var(--font-sans)",
    sample: "Locked baselines, honest leaderboards, non-custodial tips.",
    notes: "400 for body, 500–600 for labels. Never below 14px on marketing pages.",
  },
  {
    name: "JetBrains Mono",
    role: "Data / commands / mints",
    stack: "var(--font-mono)",
    sample: "/tip 0.5 SOL · fee 1% · 6 decimals",
    notes: "Uppercase + 0.2em tracking for eyebrow labels. Always mono for addresses and numbers.",
  },
];

/** Voice rules — these are compliance-relevant, not stylistic preferences. */
export const VOICE_RULES = {
  do: [
    "Sell the utility: locked baselines, receipts, leaderboards, tipping.",
    "Say non-custodial plainly — no keys, no funds held, user signs everything.",
    "Blunt degen register, but every claim maps to something already shipped.",
    "State the 1% service fee openly wherever buying or cashing out is mentioned.",
  ],
  dont: [
    'Never promise returns, yield, APY, or "earn by holding".',
    "Never imply $BRUH is on sale or minted before it actually is.",
    "No fake stats, fake testimonials, fake partner logos or fake volume.",
    "Never call the bot a wallet, exchange, custodian or financial advisor.",
  ],
};

/** Ready-to-paste copy blocks for socials, listings and group pitches. */
export const COPY_BLOCKS: Array<{ id: string; label: string; note: string; text: string }> = [
  {
    id: "one-liner",
    label: "One-liner",
    note: "Bot bio, directory listings, link-in-bio",
    text: "BRUH Legends — the Telegram bot that locks a baseline on every call, ranks your callers honestly, and lets the group tip them on Solana. Non-custodial.",
  },
  {
    id: "tg-bio",
    label: "Telegram bot description",
    note: "BotFather /setdescription (max 512 chars)",
    text: "Call tracking and tipping for crypto group chats. /call <mint> locks price, market cap and liquidity the second a call lands. Milestones fire once. BRUH Score ranks callers inside your group only. /tip sends Solana Pay requests you sign in your own wallet — the bot never holds keys or funds.",
  },
  {
    id: "x-launch",
    label: "X launch post",
    note: "Under 280 chars",
    text: "Your group chat has been keeping score with screenshots.\n\nBRUH Legends locks a baseline on every call, tracks it on-chain, and lets the chat tip the caller who earned it.\n\nNon-custodial. Group-isolated. Receipts, not vibes.",
  },
  {
    id: "admin-pitch",
    label: "Group admin pitch",
    note: "DM / pinned message",
    text: "Add BRUH Legends and run /bruh_setup. Two minutes later your chat has seasons, locked call baselines, a leaderboard nobody can fake, dispute handling and CSV exports. Tips go wallet-to-wallet on Solana — the bot never touches funds.",
  },
  {
    id: "token-status",
    label: "$BRUH status line",
    note: "Use verbatim until the mint is live",
    text: "$BRUH is not minted yet. Nothing on this site is an offer to sell it. Follow the official BRUH channels for verified launch updates.",
  },
  {
    id: "fee-disclosure",
    label: "Fee disclosure",
    note: "Any buy / cash-out surface",
    text: "A 1% service fee is applied at the app level on the buy leg and again on the cash-out leg, sent to the BRUH treasury wallet. $BRUH itself is a plain SPL token with no transfer tax.",
  },
];

export const TAGLINES = [
  "Call it. Track it. Reward the legends.",
  "Receipts, not vibes.",
  "Non-custodial tipping for Telegram degens.",
  "",
];
