# BRUH — what's left (Phase 7 slice)

Phases 0–6 are shipped: bot, calls, milestones, leaderboards, group wallets, Solana Pay tipping, moderation, seasons, Mini App, policy pages, digests, initData HMAC. The remaining work is the spec items that were deliberately deferred, plus the safety gates before real money moves.

## 1. Market data trust (highest risk)

Only one price source is wired (DexScreener), so "provider disagreement" quarantine can never trigger and an outage stalls every call.

- Add a second provider behind the existing adapter interface, with failover.
- Cross-check the two: disagreement beyond a threshold quarantines the observation instead of recording it.
- Never manufacture a zero price on provider failure.

## 2. Acceptance tests still missing

The suite covers scoring, mint extraction, unit conversion and announcements. The spec's highest-risk cases are not yet covered:

- Two groups / two wallets isolation; cross-group wallet resolution blocked.
- First-valid-caller wins; duplicate Telegram `update_id` ignored; replayed callback rejected.
- Duplicate observation cannot double-fire a milestone.
- Forged `initData` rejected; nonce reuse rejected.
- Expired tip intent uncountable; wrong recipient / mint / amount / reference fails verification.

## 3. Devnet validation before mainnet funds

The app is mainnet-beta today. Add a network switch exercise: run the wallet-verification and tipping flows end to end on devnet, confirm verification passes and fails in the right places, then flip back. One config value, no code rewrite.

## 4. BRUH token path

Nothing token-specific is built yet — the `supported_assets`, `bruh_price_quotes`, `swap_intents` and `verified_swaps` tables exist but have no code. When you have a mint:

- Quote locking with expiry, two-step "Acquire BRUH" (external DEX aggregator) then "Send tip".
- Store historical BRUH quantity plus execution-time USD estimate.
- Flip the `supported_assets` row on; everything stays gated until then.

## 5. Leaderboard periods and categories

Leaderboards are season-scoped only. Add 7-day / 30-day / all-time windows and the spec's categories, with the minimum-sample rule applied per window.

## 6. Historical CSV import

Admin import of past calls, written with status `imported` so they are visibly distinct and excluded from live tracking.

## 7. Launch checklist

- Publish the app so the Mini App and webhook run on the stable production URL.
- BotFather: set the Mini App menu button, command list and group privacy mode.
- Confirm the production webhook secret and cron hooks point at the published URL.

## Suggested order

1 and 2 first (they protect the money paths), then 3, then 7 to go live. 4 waits on your mint; 5 and 6 are polish and can follow.

## Technical notes

- Second provider slots into `src/lib/market.server.ts` behind the existing `provider` field; quarantine reuses `market_observations.quarantined` / `quarantine_reason`.
- Tests extend the existing Vitest setup under `tests/`, using pure server-lib functions plus fixture rows — no live network calls.
- Network switch is the existing `SOLANA_NETWORK` config value read in `bruh-config.server.ts`.
