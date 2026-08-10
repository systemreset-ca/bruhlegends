# BRUH Legends — Brand theme + marketing site

Turn the current plain landing page into a real product site for the Telegram bot (Trojan-bot style: sell the utility to users, callers and group admins), plus a dedicated `$BRUH` / Bruh Legends token section for the upcoming mint and launch.

## 1. Theme: "Colosseum Degen"

Pulled straight from the two artwork files — black arena, molten gold, imperial purple, acid-lime charts.

Token palette (oklch in `src/styles.css`):

- `--background` near-black obsidian, `--card` a hair lighter with gold-tinted borders
- `--primary` acid lime (CTA, numbers, up-only accents)
- `--accent` molten gold (headlines, laurels, medals)
- `--secondary` imperial purple (badges, secondary surfaces)
- `--destructive` ember red for risk/warning copy
- New tokens: `--gradient-gold`, `--gradient-lime`, `--gradient-arena`, `--glow-lime`, `--glow-gold`, `--shadow-plinth`, plus a subtle grid/scanline utility for arena backdrop

Typography (loaded via `<link>` in `__root.tsx`, referenced in `@theme`):

- Display: heavy condensed athletic face for BRUH-style headlines
- Body: clean geometric sans
- Mono: terminal mono for commands, mints, numbers

Existing shadcn semantics stay intact so every current page (app, policy pages) inherits the new look. No hardcoded colors in components.

## 2. Site structure (routes)

- `/` — hero using the Bruh Legends key art, one-line pitch, install-the-bot CTA, social proof strip, feature grid, "how a call works" timeline, command table, group-admin pitch, FAQ, footer
- `/token` — `$BRUH` / Bruh Legends: what the token is, utility inside the bot (tipping asset, fee model), the 1% buy / 1% cash-out service fee explained honestly, mint facts (SPL, 6 decimals, fixed supply, revoked authorities, Raydium CPMM, locked liquidity), launch roadmap, "not live yet" status banner, risk disclosure links
- `/groups` — for group admins: setup steps, moderation, seasons, exports, privacy controls
- Keep `/privacy`, `/terms`, `/risk`, `/app`

Shared header + footer in `__root.tsx` with nav across bot / token / admins, and links to X and Telegram.

## 3. Imagery

Use the two uploaded artworks as CDN assets: the square emblem as logo/favicon-scale mark, the wide banner as the hero. Add `og:image` on `/` and `/token` pointing at the hosted banner URL.

## 4. Copy rules

- Sell the utility, never returns. No "earn by holding", no profit language.
- Token page states clearly the mint is not live and nothing is for sale yet.
- Every claim maps to something already built in the bot.

## Technical notes

- Frontend only; no schema, server function, or bot logic changes.
- Fonts via `<link>` in the root route head, families registered in `@theme` (Tailwind v4, no config file).
- Artwork via `lovable-assets create` pointer JSON in `src/assets`, imported in components.
- Each new route gets its own `head()` with unique title/description/og tags.
