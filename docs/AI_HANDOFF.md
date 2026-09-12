# BRUH current handoff

Inspection date: 2026-09-12 (America/Toronto).
Code baseline: `main` at `941fdf163f92d289f9ef6eadb51ca65e419e3ffe`.
Implementation branch: `codex/record-complete-privilege-hardening`.
Scope: record completed Cloud privilege verification and hardening for every table flagged by Lovable's basic security scanner. No secret value is included.

## Access and context

- Existing GitHub CLI login reports `ADMIN` for private `systemreset-ca/bruhlegends`; clone succeeded. The separate GitHub connector returned 404, so CLI and connector access must not be conflated.
- Lovable synchronized and published merge commit `870cef379e8cf7136f969ccbef546291e855f3b5`. The public bruh.tips homepage loaded after publication and links to @BRUHLegendsBot. Backend health remains unverified. See the [production publish record](operations/2026-09-12-production-publish-870cef37.md).
- Read the owner's pasted attachment, the original plan, fee plan, mint notes/setup guide, later phase plans, repository instructions and existing Work chat `Team Up Chats`.
- GitHub is the shared authority; Codex leads engineering/integration, Lovable handles UI, Work handles research/documentation proposals. See [delivery plan](PROJECT_PLAN.md) and [Work brief](WORK_CHAT_BRIEF.md).

## What exists in source

| Area | Evidence | Verification limit |
| --- | --- | --- |
| Stack | `package.json`: TanStack Start `1.168.32`, Router `1.170.18`, React `^19.2.0`, Vite `^8.2.0`, Supabase JS `^2.112.2`, Vitest `^4.1.10`; `bun.lock` present | Manifest constraints, not installed/resolved version verification |
| UI | `src/routes/app.tsx`, marketing/group/token/tiptek routes, policy routes and brand components | Preview observed; complete user journeys not tested |
| Bot | `src/lib/bot.server.ts`, `telegram.server.ts`, public webhook route | Implementation present; live bot identity and processing not verified |
| Backend | Calls, market, scoring, wallets, tips, Solana, moderation, imports, announcements, data rights, Mini App and session modules under `src/lib/` | Initial selective reading; not a complete audit |
| Database | Ten migrations under `supabase/migrations/`; generated types; RLS statements present | The managed Drizzle journal records seven applied entries through `0006`; both privilege migrations are applied and verified |
| Market | `market.server.ts` includes DexScreener and Jupiter, cross-check and fallback | Historical Phase 7 missing-provider statement is stale; live API support unverified |
| Fees | `fees.server.ts` has split/quote/record/confirm/report helpers, plus migration/tests | Search found fee record/confirmation definitions without an integrated application swap caller; do not describe complete buy/sell as shipped |
| Tests | Ten files including scheduler authentication, tip-scope, Telegram `initData` and queue-helper adversarial cases | 65 tests pass locally; database and live-provider integration coverage remains incomplete |

Scripts: `dev`, `build`, `build:dev`, `preview`, `lint`, `typecheck`, `format`, `test`. No `.github` workflow directory exists yet. CI still needs a reproducible Bun lockfile-based environment.

## Priority findings for follow-up

1. **Scheduler authentication and load:** merged `main` protects scheduler routes with `BRUH_SCHEDULER_SECRET`, sent in `X-BRUH-Scheduler-Secret`. The helper fails closed when missing or shorter than 32 characters and uses constant-time comparison. Lovable preserved the credential in its server secret store and Supabase Vault. Call refresh now checks every 15 minutes, while tip and Telegram checks retain their responsive cadence but make no outbound HTTP request when their database predicates are false. Digest/credential maintenance runs hourly, retention pruning daily, and cron run history is kept for 14 days. A bounded empty-work observation recorded three successful conditional runs and zero outbound requests; safe one-off calls to all five HTTP routes returned 200. Idle application invocations are 25/day, about 750 per 30 days. See the [load-reduction operation record](operations/2026-09-12-scheduler-load-reduction.md).
2. **Group isolation and tip verification:** merged `main` validates both memberships against the requested group before wallet resolution, rejects banned memberships, expires intents before RPC lookup, scans later reference signatures, and requires the transferred amount to match exactly. PostgreSQL now makes caller, season, sender, recipient, call and dispute relationships group-scoped. Live devnet verification still remains.
3. **Webhook durability:** merged `main` stores the authenticated raw update before returning success. A scheduler-only route claims ready rows with `FOR UPDATE SKIP LOCKED`, per-attempt lease tokens, bounded exponential retry and a ten-attempt dead-letter state. Database state is protected from concurrent workers; external Telegram sends still cannot be made exactly-once across a process crash, so handlers must continue to make their durable effects idempotent. The migration and scheduler caller are active; real Telegram update processing remains unverified.
4. **Session and wallet challenge consumption:** merged `main` moves login-token exchange and wallet-challenge completion into service-role-only database functions. Each operation locks or conditionally updates its one-time credential and commits its dependent records together. The wallet flow keeps the previous wallet active until its 30-minute replacement cutoff, and authentic `initData` dated more than 30 seconds in the future is rejected. Lovable reported the database functions applied; live login and wallet-link journeys remain unverified.
5. **Credential documentation mismatch:** outgoing Telegram calls use the Lovable connector gateway with `LOVABLE_API_KEY` and `TELEGRAM_API_KEY`; `verifyInitData` separately needs `TELEGRAM_BOT_TOKEN`. The plan's gateway statement does not cover that actual requirement.
6. **Launch defaults:** `bruh-config.server.ts` defaults to mainnet, leaves direct asset tips enabled and enables its BRUH flag based on nonempty mint text. Audit all actual enforcement paths and align network, RPC, allowlist and explicit release gates before claiming launch readiness.
7. **Claims vs evidence:** later plans say Phases 0–6 are shipped while listing unfinished safety tests; current code has features those plans call missing. The mint guide calls fees built, but helpers are not a verified swap product. Build a requirements-to-code-to-test matrix before declaring completion.
8. **Lovable security warnings:** both hardening migrations are applied and verified across all 21 flagged tables. `PUBLIC`, `anon` and `authenticated` have no table privileges; `service_role` retains full access; each table has one restrictive false client policy; rows are unchanged; server probes pass; and the Lovable scanner reports no issues. Lovable's managed owner path recorded re-entrant duplicates as `0004` and `0006`; preserve all four migration records as applied history. The platform-managed `supabase_admin` defaults remain unchanged. See the [Cloud privilege audit](operations/2026-09-12-cloud-privilege-audit.md).

These are source-based findings and audit priorities, not proof of an exploited production service.

## Configuration inventory (names only)

Observed server references include `LOVABLE_API_KEY`, `TELEGRAM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `APP_URL`, `SOLANA_NETWORK`, `SOLANA_RPC_URL`, `BRUH_TOKEN_MINT`, `FEE_BPS`, `FEE_TREASURY_ADDRESS`, `BRUH_SCHEDULER_SECRET`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_ANON_KEY`. `BRUH_SCHEDULER_SECRET` must be a randomly generated value of at least 32 characters and must be stored in the server secret manager and scheduler vault, never in client code. No secret values were requested or copied.

## Validation and next action

Local validation passes 65 tests across ten files, strict TypeScript checking, focused lint and the production build. Existing TanStack `inputValidator` deprecation and large-bundle warnings remain. Repository-wide lint remains blocked by pre-existing CRLF/Prettier failures throughout untouched files. Authenticated conditional scheduler behavior is verified in preview with empty work queues; production database binding, effective authorization, real queued work and devnet transfers have not been verified. No release readiness is claimed.

Next: add idempotency coverage for Telegram updates that trigger external replies and durable state changes, then exercise a real end-to-end Telegram update in preview. Production publication still requires a final release check for domain/database binding, Telegram credentials and devnet-safe provider configuration.
