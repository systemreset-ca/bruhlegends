# BRUH current handoff

Inspection date: 2026-09-11 (America/Toronto).
Code baseline: `main` at `1038d0db698a58997d1a42df6b371ad38e6ba77b`.
Implementation branch: `codex/tip-isolation`.
Scope: enforce same-group tip membership, reject expired intents before chain lookup, and require exact transfer amounts. No schema, secret value or scheduler configuration is included.

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
| Database | Five migrations under `supabase/migrations/`; generated types; RLS statements present | Applied migrations and effective authorization not tested |
| Market | `market.server.ts` includes DexScreener and Jupiter, cross-check and fallback | Historical Phase 7 missing-provider statement is stale; live API support unverified |
| Fees | `fees.server.ts` has split/quote/record/confirm/report helpers, plus migration/tests | Search found fee record/confirmation definitions without an integrated application swap caller; do not describe complete buy/sell as shipped |
| Tests | Nine files including scheduler authentication and tip-scope adversarial cases | 57 tests pass locally; database and live-provider integration coverage remains incomplete |

Scripts: `dev`, `build`, `build:dev`, `preview`, `lint`, `typecheck`, `format`, `test`. No `.github` workflow directory exists yet. CI still needs a reproducible Bun lockfile-based environment.

## Priority findings for follow-up

1. **Scheduler authentication:** merged `main` replaces public Supabase-key authorization with a dedicated `BRUH_SCHEDULER_SECRET`, sent in `X-BRUH-Scheduler-Secret`. The helper fails closed when missing or shorter than 32 characters and uses constant-time comparison. Production publication and synchronized scheduler configuration remain required.
2. **Tip isolation and verification:** implementation branch `codex/tip-isolation` validates both memberships against the requested group before wallet resolution, rejects banned memberships, expires intents before RPC lookup, and requires the transferred amount to match exactly. Database-level relationship constraints and live devnet verification still remain.
3. **Webhook durability:** `src/routes/api/public/telegram/webhook.ts` awaits `handleUpdate`, catches errors and returns success. This does not demonstrate the spec's fast durable receipt plus asynchronous retry behavior. Audit deduplication and crash recovery together so retries neither lose nor duplicate effects.
4. **Session consumption:** `exchangeLoginToken` in `src/lib/session.server.ts` reads then updates a login token in separate operations. Review concurrent redemption and implement atomic consumption with expiry enforcement. Test forged, stale and future-dated `initData`, not just normal signatures.
5. **Credential documentation mismatch:** outgoing Telegram calls use the Lovable connector gateway with `LOVABLE_API_KEY` and `TELEGRAM_API_KEY`; `verifyInitData` separately needs `TELEGRAM_BOT_TOKEN`. The plan's gateway statement does not cover that actual requirement.
6. **Launch defaults:** `bruh-config.server.ts` defaults to mainnet, leaves direct asset tips enabled and enables its BRUH flag based on nonempty mint text. Audit all actual enforcement paths and align network, RPC, allowlist and explicit release gates before claiming launch readiness.
7. **Claims vs evidence:** later plans say Phases 0–6 are shipped while listing unfinished safety tests; current code has features those plans call missing. The mint guide calls fees built, but helpers are not a verified swap product. Build a requirements-to-code-to-test matrix before declaring completion.

These are source-based findings and audit priorities, not proof of an exploited production service.

## Configuration inventory (names only)

Observed server references include `LOVABLE_API_KEY`, `TELEGRAM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `APP_URL`, `SOLANA_NETWORK`, `SOLANA_RPC_URL`, `BRUH_TOKEN_MINT`, `FEE_BPS`, `FEE_TREASURY_ADDRESS`, `BRUH_SCHEDULER_SECRET`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_ANON_KEY`. `BRUH_SCHEDULER_SECRET` must be a randomly generated value of at least 32 characters and must be stored in the server secret manager and scheduler vault, never in client code. No secret values were requested or copied.

## Validation and next action

The implementation branch passes 57 tests across nine files, strict TypeScript checking, focused lint and the production build. The build still reports existing TanStack `inputValidator` deprecations and an oversized client chunk. Repository-wide lint remains blocked by pre-existing CRLF/Prettier failures throughout untouched files. Live database checks, scheduler invocation and devnet transfers have not been run. No release readiness is claimed.

Next: merge the tip-isolation slice, configure `BRUH_SCHEDULER_SECRET` in both deployment and scheduler, then implement durable webhook receipt, replay controls and database-level group constraints.
