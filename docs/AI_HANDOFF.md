# BRUH current handoff

Inspection date: 2026-09-12 (America/Toronto).
Code baseline: `main` at `4b327d40b6a9c1d46a46b00486f68cb81916816e`.
Production application baseline: `67f5dfd5ee1cf0e915911b1c8f95ef4b09da8c4b`.
Scope: record the published and verified immediate Telegram reply path, then identify the next provider and devnet safety work. No secret value is included.

## Access and context

- Existing GitHub CLI login reports `ADMIN` for private `systemreset-ca/bruhlegends`; clone succeeded. The separate GitHub connector returned 404, so CLI and connector access must not be conflated.
- Lovable published exact GitHub `main` commit `67f5dfd5ee1cf0e915911b1c8f95ef4b09da8c4b`. The public homepage returned HTTP 200 and an unauthenticated webhook POST returned HTTP 401. A real private-chat `/help` completed inline in about 2.71 seconds with first-attempt processing and delivery, no error and no scheduler fallback. See the [immediate fast-path rollout](operations/2026-09-12-telegram-immediate-fast-path.md), the [durable outbox rollout](operations/2026-09-12-telegram-outbox.md) and the earlier [production publish record](operations/2026-09-12-production-publish-870cef37.md).
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
| Tests | Ten files including scheduler authentication, tip-scope, Telegram `initData` and queue/outbox adversarial cases | 68 tests pass locally; database and live-provider integration coverage remains incomplete |

Scripts: `dev`, `build`, `build:dev`, `preview`, `lint`, `typecheck`, `format`, `test`. No `.github` workflow directory exists yet. CI still needs a reproducible Bun lockfile-based environment.

## Priority findings for follow-up

1. **Scheduler authentication and load:** merged `main` protects scheduler routes with `BRUH_SCHEDULER_SECRET`, sent in `X-BRUH-Scheduler-Secret`. The helper fails closed when missing or shorter than 32 characters and uses constant-time comparison. Lovable preserved the credential in its server secret store and Supabase Vault. Call refresh now checks every 15 minutes, while tip and Telegram checks retain their responsive cadence but make no outbound HTTP request when their database predicates are false. Digest/credential maintenance runs hourly, retention pruning daily, and cron run history is kept for 14 days. A bounded empty-work observation recorded three successful conditional runs and zero outbound requests; safe one-off calls to all five HTTP routes returned 200. Idle application invocations are 25/day, about 750 per 30 days. See the [load-reduction operation record](operations/2026-09-12-scheduler-load-reduction.md).
2. **Group isolation and tip verification:** merged `main` validates both memberships against the requested group before wallet resolution, rejects banned memberships, expires intents before RPC lookup, scans later reference signatures, and requires the transferred amount to match exactly. PostgreSQL now makes caller, season, sender, recipient, call and dispute relationships group-scoped. Live devnet verification still remains.
3. **Webhook durability and latency:** merged `main` stores the authenticated raw update before processing, queues outbound replies durably by update/action key, and attempts exact-update processing and delivery inline. Failures remain queued for the existing worker, with leases, bounded backoff and dead-letter handling. Cloud claims and privileges passed a rolled-back exercise, and a production `/help` completed request-to-send in about 2.71 seconds without scheduler fallback. See the [immediate fast-path rollout](operations/2026-09-12-telegram-immediate-fast-path.md) and [outbox rollout](operations/2026-09-12-telegram-outbox.md). Telegram has no general idempotency key, so a crash after Telegram accepts an action but before `sent_at` is stored remains an explicit duplicate-delivery window.
4. **Session and wallet challenge consumption:** merged `main` moves login-token exchange and wallet-challenge completion into service-role-only database functions. Each operation locks or conditionally updates its one-time credential and commits its dependent records together. The wallet flow keeps the previous wallet active until its 30-minute replacement cutoff, and authentic `initData` dated more than 30 seconds in the future is rejected. Lovable reported the database functions applied; live login and wallet-link journeys remain unverified.
5. **Credential documentation mismatch:** outgoing Telegram calls use the Lovable connector gateway with `LOVABLE_API_KEY` and `TELEGRAM_API_KEY`; `verifyInitData` separately needs `TELEGRAM_BOT_TOKEN`. The plan's gateway statement does not cover that actual requirement.
6. **Launch defaults:** `bruh-config.server.ts` defaults to mainnet, leaves direct asset tips enabled and enables its BRUH flag based on nonempty mint text. Audit all actual enforcement paths and align network, RPC, allowlist and explicit release gates before claiming launch readiness.
7. **Claims vs evidence:** later plans say Phases 0–6 are shipped while listing unfinished safety tests; current code has features those plans call missing. The mint guide calls fees built, but helpers are not a verified swap product. Build a requirements-to-code-to-test matrix before declaring completion.
8. **Lovable security warnings:** both hardening migrations are applied and verified across all 21 originally flagged tables. `PUBLIC`, `anon` and `authenticated` have no table privileges; `service_role` retains full access; each table has one restrictive false client policy; rows are unchanged; and server probes pass. Lovable's managed owner path recorded re-entrant duplicates as `0004` and `0006`; preserve all four privilege-migration records as applied history. The latest scan showed advisories for `market_observations` and `supported_assets` because the scanner treats deny-by-design server-only tables as warnings; their effective access remains independently verified. The platform-managed `supabase_admin` defaults remain unchanged. See the [Cloud privilege audit](operations/2026-09-12-cloud-privilege-audit.md).

These are source-based findings and audit priorities, not proof of an exploited production service.

## Configuration inventory (names only)

Observed server references include `LOVABLE_API_KEY`, `TELEGRAM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `APP_URL`, `SOLANA_NETWORK`, `SOLANA_RPC_URL`, `BRUH_TOKEN_MINT`, `FEE_BPS`, `FEE_TREASURY_ADDRESS`, `BRUH_SCHEDULER_SECRET`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_ANON_KEY`. `BRUH_SCHEDULER_SECRET` must be a randomly generated value of at least 32 characters and must be stored in the server secret manager and scheduler vault, never in client code. No secret values were requested or copied.

## Validation and next action

Local validation passes 68 tests across ten files, strict TypeScript checking and the production build. Existing TanStack `inputValidator` deprecation and large-bundle warnings remain. Repository-wide lint remains blocked by pre-existing CRLF/Prettier failures throughout untouched files. Authenticated conditional scheduler behavior is verified in Cloud with empty work queues; outbox and exact-update claim rules passed rolled-back database exercises; and real Telegram `/help` delivery is verified. Devnet transfers and live Solana-provider behavior have not been verified. No real-funds release readiness is claimed.

Next: make `devnet` the explicit safe validation configuration, verify the configured Solana RPC provider without exposing its credential, and run a controlled end-to-end devnet tip. Before any real-funds launch, add source-update idempotency to multi-write command handlers, complete the provider/security review, require explicit mainnet enablement and enforce the intended mint allowlist.
