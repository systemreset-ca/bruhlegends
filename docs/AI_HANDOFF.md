# BRUH current handoff

Inspection date: 2026-09-12 (America/Toronto).
Code baseline: `main` at `f00c60fb86c0b3b74ce278768756a64f2a3edaad`.
Implementation branch: `codex/record-cloud-migrations`.
Scope: record the verified Lovable Cloud migration state and remaining scheduler configuration blocker. Documentation only; no secret value or runtime configuration is included.

## Access and context

- Existing GitHub CLI login reports `ADMIN` for private `systemreset-ca/bruhlegends`; clone succeeded. The separate GitHub connector returned 404, so CLI and connector access must not be conflated.
- Lovable synchronized and published merge commit `b491c99839f4986c735eb702e5e28643bc67a46b`. The public bruh.tips homepage loaded after publication and links to @BRUHLegendsBot. Backend health remains unverified.
- Read the owner's pasted attachment, the original plan, fee plan, mint notes/setup guide, later phase plans, repository instructions and existing Work chat `Team Up Chats`.
- GitHub is the shared authority; Codex leads engineering/integration, Lovable handles UI, Work handles research/documentation proposals. See [delivery plan](PROJECT_PLAN.md) and [Work brief](WORK_CHAT_BRIEF.md).

## What exists in source

| Area | Evidence | Verification limit |
| --- | --- | --- |
| Stack | `package.json`: TanStack Start `1.168.32`, Router `1.170.18`, React `^19.2.0`, Vite `^8.2.0`, Supabase JS `^2.112.2`, Vitest `^4.1.10`; `bun.lock` present | Manifest constraints, not installed/resolved version verification |
| UI | `src/routes/app.tsx`, marketing/group/token/tiptek routes, policy routes and brand components | Preview observed; complete user journeys not tested |
| Bot | `src/lib/bot.server.ts`, `telegram.server.ts`, public webhook route | Implementation present; live bot identity and processing not verified |
| Backend | Calls, market, scoring, wallets, tips, Solana, moderation, imports, announcements, data rights, Mini App and session modules under `src/lib/` | Initial selective reading; not a complete audit |
| Database | Eight migrations under `supabase/migrations/`; generated types; RLS statements present | Lovable reported all eight applied to the connected Cloud database on 2026-09-12; production database binding and effective authorization still need independent verification |
| Market | `market.server.ts` includes DexScreener and Jupiter, cross-check and fallback | Historical Phase 7 missing-provider statement is stale; live API support unverified |
| Fees | `fees.server.ts` has split/quote/record/confirm/report helpers, plus migration/tests | Search found fee record/confirmation definitions without an integrated application swap caller; do not describe complete buy/sell as shipped |
| Tests | Ten files including scheduler authentication, tip-scope, Telegram `initData` and queue-helper adversarial cases | 62 tests pass locally; database and live-provider integration coverage remains incomplete |

Scripts: `dev`, `build`, `build:dev`, `preview`, `lint`, `typecheck`, `format`, `test`. No `.github` workflow directory exists yet. CI still needs a reproducible Bun lockfile-based environment.

## Priority findings for follow-up

1. **Scheduler authentication:** merged `main` replaces public Supabase-key authorization with a dedicated `BRUH_SCHEDULER_SECRET`, sent in `X-BRUH-Scheduler-Secret`. The helper fails closed when missing or shorter than 32 characters and uses constant-time comparison. Lovable found active `pg_cron` jobs for call refresh and tip verification still sending only the obsolete API-key header and returning 401; no Telegram update worker job exists. Secret and all three jobs must be configured together before publication.
2. **Group isolation and tip verification:** merged `main` validates both memberships against the requested group before wallet resolution, rejects banned memberships, expires intents before RPC lookup, scans later reference signatures, and requires the transferred amount to match exactly. PostgreSQL now makes caller, season, sender, recipient, call and dispute relationships group-scoped. Live devnet verification still remains.
3. **Webhook durability:** merged `main` stores the authenticated raw update before returning success. A scheduler-only route claims ready rows with `FOR UPDATE SKIP LOCKED`, per-attempt lease tokens, bounded exponential retry and a ten-attempt dead-letter state. Database state is protected from concurrent workers; external Telegram sends still cannot be made exactly-once across a process crash, so handlers must continue to make their durable effects idempotent. The migration is applied; the scheduler caller is absent.
4. **Session and wallet challenge consumption:** merged `main` moves login-token exchange and wallet-challenge completion into service-role-only database functions. Each operation locks or conditionally updates its one-time credential and commits its dependent records together. The wallet flow keeps the previous wallet active until its 30-minute replacement cutoff, and authentic `initData` dated more than 30 seconds in the future is rejected. Live database application remains unverified.
5. **Credential documentation mismatch:** outgoing Telegram calls use the Lovable connector gateway with `LOVABLE_API_KEY` and `TELEGRAM_API_KEY`; `verifyInitData` separately needs `TELEGRAM_BOT_TOKEN`. The plan's gateway statement does not cover that actual requirement.
6. **Launch defaults:** `bruh-config.server.ts` defaults to mainnet, leaves direct asset tips enabled and enables its BRUH flag based on nonempty mint text. Audit all actual enforcement paths and align network, RPC, allowlist and explicit release gates before claiming launch readiness.
7. **Claims vs evidence:** later plans say Phases 0–6 are shipped while listing unfinished safety tests; current code has features those plans call missing. The mint guide calls fees built, but helpers are not a verified swap product. Build a requirements-to-code-to-test matrix before declaring completion.

These are source-based findings and audit priorities, not proof of an exploited production service.

## Configuration inventory (names only)

Observed server references include `LOVABLE_API_KEY`, `TELEGRAM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `APP_URL`, `SOLANA_NETWORK`, `SOLANA_RPC_URL`, `BRUH_TOKEN_MINT`, `FEE_BPS`, `FEE_TREASURY_ADDRESS`, `BRUH_SCHEDULER_SECRET`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_ANON_KEY`. `BRUH_SCHEDULER_SECRET` must be a randomly generated value of at least 32 characters and must be stored in the server secret manager and scheduler vault, never in client code. No secret values were requested or copied.

## Validation and next action

Local validation passes 62 tests across ten files, strict TypeScript checking, focused lint and the production build. Lovable independently reported a successful bundle, clean type check and the same 62 passing tests after applying migrations. Repository-wide lint remains blocked by pre-existing CRLF/Prettier failures throughout untouched files. Production database binding, effective authorization, successful scheduler invocation and devnet transfers have not been verified. No release readiness is claimed.

Next: generate one dedicated `BRUH_SCHEDULER_SECRET`, store it in the Lovable server environment and `pg_cron`/Vault, update the two existing jobs, and add a job for `POST /api/public/hooks/process-telegram-updates`. Verify successful authenticated runs in preview before publishing the backend commits, then add idempotency coverage for update-triggered state changes.
