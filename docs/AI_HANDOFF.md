# BRUH current handoff

Inspection date: 2026-09-12 (America/Toronto).
Code baseline: `main` at `275a60e9d892581b0476ada2d6d8739dfa1f6b28`.
Production application baseline: `59fa4b0882948de1b73c827461656d283b58e580`.
Implementation branch: `codex/atomic-tip-confirmation`; not deployed.
Scope: atomic tip settlement while the owner prepares the second Telegram account/phone for one controlled user-signed devnet SOL tip. No secret value is included.

## Latest engineering slice

The network-pinned tip release is published; homepage and token page returned 200 and the unauthenticated webhook returned 401. See the [publication record](operations/2026-09-12-production-publish-59fa4b08.md). Current source has 80 passing tests before the new settlement work.

The review branch replaces separate unchecked receipt/status/audit writes with service-role-only `settle_tip_intent`, including locked expiry, snapshot checks, and unique-receipt conflict handling. It incorporates merged PR #33's bounded, reference-checked verifier. All 99 tests across fourteen files and strict TypeScript pass. See the [settlement decision and Cloud runbook](decisions/0002-atomic-tip-settlement.md) and [verifier decision](decisions/0003-bounded-solana-verification.md). Cloud application, database concurrency/failure exercises, and deployment are pending. The historical inventory below records earlier release evidence; it does not establish validation of the new function.

## Access and context

- Existing GitHub CLI login reports `ADMIN` for private `systemreset-ca/bruhlegends`; clone succeeded. The separate GitHub connector returned 404, so CLI and connector access must not be conflated.
- Lovable published exact GitHub `main` commit `a8e43662d7613cb69de4cd2c2dc52530dc2a19d7`. The public homepage and token page returned HTTP 200, the corrected devnet copy was present, and an unauthenticated webhook POST returned HTTP 401. A real private-chat `/help` completed inline in about 2.71 seconds with first-attempt processing and delivery, no error and no scheduler fallback. See the [devnet safety publish](operations/2026-09-12-production-publish-a8e43662.md), [immediate fast-path rollout](operations/2026-09-12-telegram-immediate-fast-path.md), and [durable outbox rollout](operations/2026-09-12-telegram-outbox.md).
- Read the owner's pasted attachment, the original plan, fee plan, mint notes/setup guide, later phase plans, repository instructions and existing Work chat `Team Up Chats`.
- GitHub is the shared authority; Codex leads engineering/integration, Lovable handles UI, Work handles research/documentation proposals. See [delivery plan](PROJECT_PLAN.md) and [Work brief](WORK_CHAT_BRIEF.md).

## What exists in source

| Area | Evidence | Verification limit |
| --- | --- | --- |
| Stack | `package.json`: TanStack Start `1.168.32`, Router `1.170.18`, React `^19.2.0`, Vite `^8.2.0`, Supabase JS `^2.112.2`, Vitest `^4.1.10`; `bun.lock` present | Manifest constraints, not installed/resolved version verification |
| UI | `src/routes/app.tsx`, marketing/group/token/tiptek routes, policy routes and brand components | Preview observed; complete user journeys not tested |
| Bot | `src/lib/bot.server.ts`, `telegram.server.ts`, public webhook route | Live `/help` processing and reply verified; broader command journeys remain unverified |
| Backend | Calls, market, scoring, wallets, tips, Solana, moderation, imports, announcements, data rights, Mini App and session modules under `src/lib/` | Initial selective reading; not a complete audit |
| Database | Twelve migrations under `supabase/migrations/`; generated types; RLS statements present | The repository Drizzle journal records eleven entries through Lovable's semantically identical managed duplicate `0010` |
| Market | `market.server.ts` includes DexScreener and Jupiter, cross-check and fallback | Historical Phase 7 missing-provider statement is stale; live API support unverified |
| Fees | `fees.server.ts` has split/quote/record/confirm/report helpers, plus migration/tests | Search found fee record/confirmation definitions without an integrated application swap caller; do not describe complete buy/sell as shipped |
| Tests | Twelve files including scheduler authentication, tip-scope, asset allowlisting, network release gates, Telegram `initData` and queue/outbox adversarial cases | 78 tests pass locally; database and live-provider integration coverage remains incomplete |

Scripts: `dev`, `build`, `build:dev`, `preview`, `lint`, `typecheck`, `format`, `test`. No `.github` workflow directory exists yet. CI still needs a reproducible Bun lockfile-based environment.

## Priority findings for follow-up

1. **Scheduler authentication and load:** merged `main` protects scheduler routes with `BRUH_SCHEDULER_SECRET`, sent in `X-BRUH-Scheduler-Secret`. The helper fails closed when missing or shorter than 32 characters and uses constant-time comparison. Lovable preserved the credential in its server secret store and Supabase Vault. Call refresh now checks every 15 minutes, while tip and Telegram checks retain their responsive cadence but make no outbound HTTP request when their database predicates are false. Digest/credential maintenance runs hourly, retention pruning daily, and cron run history is kept for 14 days. A bounded empty-work observation recorded three successful conditional runs and zero outbound requests; safe one-off calls to all five HTTP routes returned 200. Idle application invocations are 25/day, about 750 per 30 days. See the [load-reduction operation record](operations/2026-09-12-scheduler-load-reduction.md).
2. **Group isolation and tip verification:** merged `main` validates both memberships against the requested group before wallet resolution, rejects banned memberships, expires intents before RPC lookup, scans later reference signatures, and requires the transferred amount to match exactly. PostgreSQL now makes caller, season, sender, recipient, call and dispute relationships group-scoped. Live devnet verification still remains.
3. **Webhook durability and latency:** merged `main` stores the authenticated raw update before processing, queues outbound replies durably by update/action key, and attempts exact-update processing and delivery inline. Failures remain queued for the existing worker, with leases, bounded backoff and dead-letter handling. Cloud claims and privileges passed a rolled-back exercise, and a production `/help` completed request-to-send in about 2.71 seconds without scheduler fallback. See the [immediate fast-path rollout](operations/2026-09-12-telegram-immediate-fast-path.md) and [outbox rollout](operations/2026-09-12-telegram-outbox.md). Telegram has no general idempotency key, so a crash after Telegram accepts an action but before `sent_at` is stored remains an explicit duplicate-delivery window.
4. **Session and wallet challenge consumption:** merged `main` moves login-token exchange and wallet-challenge completion into service-role-only database functions. Each operation locks or conditionally updates its one-time credential and commits its dependent records together. The wallet flow keeps the previous wallet active until its 30-minute replacement cutoff, and authentic `initData` dated more than 30 seconds in the future is rejected. Lovable reported the database functions applied; live login and wallet-link journeys remain unverified.
5. **Credential documentation mismatch:** outgoing Telegram calls use the Lovable connector gateway with `LOVABLE_API_KEY` and `TELEGRAM_API_KEY`; `verifyInitData` separately needs `TELEGRAM_BOT_TOKEN`. The plan's gateway statement does not cover that actual requirement.
6. **Solana release gate and provider:** merged `main` defaults an unset network to devnet, rejects unknown networks, and requires both `SOLANA_MAINNET_ENABLED=true` and an explicit provider URL before mainnet can start. Asset resolution is network-scoped; mainnet USDC must match the canonical mint; and BRUH requires its enabled registry mint to exactly match `BRUH_TOKEN_MINT`. The owner-provisioned Helius endpoint passed four read-only calls in 59–125 ms and its genesis response confirmed devnet. A user-signed devnet transfer remains pending. See [Solana configuration](SOLANA_CONFIGURATION.md) and the [provider verification](operations/2026-09-12-helius-devnet-provider.md).
7. **Claims vs evidence:** later plans say Phases 0–6 are shipped while listing unfinished safety tests; current code has features those plans call missing. The mint guide calls fees built, but helpers are not a verified swap product. Build a requirements-to-code-to-test matrix before declaring completion.
8. **Lovable security warnings:** both hardening migrations are applied and verified across all 21 originally flagged tables. `PUBLIC`, `anon` and `authenticated` have no table privileges; `service_role` retains full access; each table has one restrictive false client policy; rows are unchanged; and server probes pass. Lovable's managed owner path recorded re-entrant duplicates as `0004` and `0006`; preserve all four privilege-migration records as applied history. The latest scan showed advisories for `market_observations` and `supported_assets` because the scanner treats deny-by-design server-only tables as warnings; their effective access remains independently verified. The platform-managed `supabase_admin` defaults remain unchanged. See the [Cloud privilege audit](operations/2026-09-12-cloud-privilege-audit.md).

These are source-based findings and audit priorities, not proof of an exploited production service.

## Configuration inventory (names only)

Observed server references include `LOVABLE_API_KEY`, `TELEGRAM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `APP_URL`, `SOLANA_NETWORK`, `SOLANA_RPC_URL`, `SOLANA_MAINNET_ENABLED`, `BRUH_TOKEN_MINT`, `FEE_BPS`, `FEE_TREASURY_ADDRESS`, `BRUH_SCHEDULER_SECRET`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_ANON_KEY`. `BRUH_SCHEDULER_SECRET` and the provider URL containing its API key must be stored in the server secret manager, never in client code. No secret values were requested or copied.

## Validation and next action

Local validation passes 78 tests across twelve files, strict TypeScript checking and the production build. Lovable's two regenerated Supabase integration files are excluded from ESLint while remaining covered by TypeScript and application tests; this prevents their platform formatting from blocking preview builds. Existing TanStack `inputValidator` deprecation and large-bundle warnings remain. Authenticated conditional scheduler behavior is verified in Cloud with empty work queues; outbox and exact-update claim rules passed rolled-back database exercises; real Telegram `/help` delivery is verified; and the Helius endpoint passed a read-only devnet probe. A user-signed devnet transfer has not been verified. No real-funds release readiness is claimed.

Next: run one controlled end-to-end devnet SOL tip signed only in the user's wallet. Before any real-funds launch, add source-update idempotency to multi-write command handlers and complete the provider/security review.
