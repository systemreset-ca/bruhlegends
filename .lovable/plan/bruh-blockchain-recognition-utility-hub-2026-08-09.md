# BRUH — Blockchain Recognition & Utility Hub

Telegram bot + Mini App that records crypto calls, ranks contributors, and lets members send non-custodial Solana tips to a caller's group-specific wallet.

Scope agreed: Phases 0-4 (foundation, calls, leaderboards, group wallets, tipping). Network: Solana mainnet-beta. BRUH token: not minted yet — the token-native tipping path from the addendum is built behind a feature flag and stays off until a mint address exists. Bot: created via BotFather during Phase 1.

## Non-negotiables carried from the spec

- Non-custodial always: no seed phrases, no private keys, no server-side signing, no BRUH-controlled balances.
- Group isolation: every profile, wallet, stat and leaderboard row is keyed by `(telegram_chat_id, telegram_user_id)`. No global wallet fallback.
- A tip counts only after a confirmed on-chain transaction matching recipient, mint, amount and reference.
- Audit over deletion: invalidations create events, never destroy history.
- Row Level Security on every user-reachable table; secrets never leave the server.

## Phase 0 — Foundation

- Enable Lovable Cloud (Postgres, auth, storage, server functions).
- Full schema per spec section 15: `telegram_users`, `groups`, `group_members`, `seasons`, `calls`, `market_observations`, `milestones`, `wallets` + `wallet_challenges`, `tip_intents`, `verified_transfers`, `disputes`, `webhook_updates`, `audit_events`, plus addendum tables `supported_assets`, `bruh_price_quotes`, `swap_intents`, `verified_swaps`.
- RLS + explicit GRANTs on every table; sensitive writes go through security-definer functions, never direct client inserts.
- Secrets inventory: Telegram bot token, webhook secret, Solana RPC URL, market-data provider keys.
- Dark charcoal / electric-lime / warm-gold design system, rounded cards, compact tables. No coin logo.

## Phase 1 — Bot, group onboarding, calls

- BotFather walkthrough, then a `/api/public/telegram/webhook` endpoint: validates the secret header, dedupes by `update_id`, persists fast, processes asynchronously.
- Group install/uninstall lifecycle, supergroup migration handling, admin setup wizard.
- `/call <CA>` with a preview card (token identity, pool, price, market cap, liquidity) and Confirm / Cancel / Wrong pair buttons. Reply-based calls. Immutable baseline snapshot with raw provider payload.
- First-valid-caller attribution within group + season; later posts get an "already called" reply.
- Member commands: `/start /help /calls /leaderboard /stats /wallet /tips /settings /dispute /privacy`. Admin commands: `/bruh_setup /bruh_admin /bruh_mode /bruh_rules /bruh_season /bruh_moderators /bruh_export /bruh_pause /bruh_status`.

## Phase 2 — Tracking, milestones, leaderboards

- Scheduled market refresh worker; ATH-since-call, drawdown, time-to-milestone.
- Milestones at 2x/5x/10x/25x/50x/100x, unique per `(call_id, milestone)`; quarantine on dust pools, low liquidity or provider disagreement.
- Seasons (reset without deleting history), leaderboard periods and categories, minimum-sample rule.
- BRUH Score: 40% performance, 25% consistency, 15% early discovery, 15% capped community recognition, 5% reliability. Self-tips excluded; per-pair tip influence capped.
- Disputes, invalidation, moderator roles, CSV import labelled `imported`.
- Anti-spam notification policy: compact confirmations, digest options, quiet hours, private receipts.

## Phase 3 — Group-specific wallets (Mini App)

- Telegram Mini App with server-side `initData` signature validation. `initDataUnsafe` is never trusted.
- Wallet registration always names the destination group explicitly.
- Signed-challenge verification with single-use nonces and expiry; manual addresses allowed only with an "Unverified wallet" warning.
- Wallet replacement: fresh signature + 30-minute delay; existing tip intents stay bound to the address captured at intent creation.

## Phase 4 — Non-custodial tipping

- Assets: SOL and allowlisted USDC mint. Arbitrary meme tokens not accepted.
- Flow: resolve recipient → load group wallet → show recipient, address, asset, amount, USD estimate, fee notice → create `tip_intent` with unique Solana Pay reference and expiry → Solana Pay URL + QR → user approves in their own wallet → server verifies the confirmed transaction → receipt and optional announcement.
- Privacy modes: public, pseudonymous, anonymous-to-group, private — with an honest disclosure that on-chain transfers are never anonymous.
- BRUH-token path built now, gated off: `supported_assets` row, quote locking, two-step "Acquire BRUH" then "Send tip" via an external DEX aggregator, historical BRUH quantity plus execution-time USD estimate preserved. Flips on when you supply the mint.

## Mini App screens

Group dashboard, calls explorer with call-detail timeline, member profile, tip composer, wallet/portfolio panel, admin console (health, detection mode test, provider status, rules, seasons, moderators, exports, pause switch).

## Compliance pages

Privacy Policy, Terms of Use, Risk Disclosure, data deletion request flow, group export, configurable raw-message retention. Onboarding and tipping disclosures per spec section 20. No guaranteed-profit or "earn by holding" language anywhere.

## Verification

Reproducible tests for the highest-risk acceptance cases: two groups / two wallets isolation, cross-group wallet resolution blocked, first-caller wins, duplicate `update_id` ignored, replayed callback rejected, duplicate observation cannot double-fire a milestone, forged `initData` rejected, nonce reuse rejected, expired intent uncountable, and wrong recipient/mint/amount/reference failing verification.

## Technical notes

- TanStack Start on Lovable Cloud. Telegram webhook and all external callbacks live under `src/routes/api/public/*` with in-handler signature verification; app-internal logic uses `createServerFn`.
- Telegram Bot API calls go through the connected Telegram connector gateway, so the raw bot token is never handled in app code.
- Solana reads via a server-side RPC endpoint; all transaction verification is server-side. The client only ever receives a Solana Pay URL or an unsigned transaction to approve in the user's own wallet.
- Market data behind a provider-adapter interface with failover; provider outages degrade gracefully and never manufacture zero prices.
- Cron-driven workers for market refresh, milestones, leaderboard materialisation, tip-status checks and retention downsampling.

## Two flags worth your decision before we ship

1. You chose mainnet-beta with real transfers. The spec itself requires devnet validation and a security review before real funds move. I will build mainnet-capable, but recommend running Phases 3-4 against devnet first via a network switch, then flipping to mainnet once the tipping tests pass. The switch is one config value.
2. Tokenomics (supply, decimals, allocation, liquidity) stays entirely your decision — I will not invent numbers, per the addendum.
