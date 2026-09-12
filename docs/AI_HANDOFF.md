# BRUH current handoff

Inspection date: 2026-09-11 (America/Toronto).
Code baseline: `main` at `ccb84df31d335c9f632c3b85403e21c47de5a474`.
Documentation branch: `codex/project-coordination`.
Scope: initial source inspection and coordination documents only. No application, schema, secret or deployment changes. The documentation commit is reported in the PR/handoff message rather than embedding its own circular SHA here.

## Access and context

- Existing GitHub CLI login reports `ADMIN` for private `systemreset-ca/bruhlegends`; clone succeeded. The separate GitHub connector returned 404, so CLI and connector access must not be conflated.
- Lovable browser was already signed in; the correct project and BRUH preview opened. Preview indicates unpublished changes; publication has not been performed. The public bruh.tips homepage also loaded and links to @BRUHLegendsBot; its deployed commit and backend health remain unverified.
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
| Tests | Seven files: announce, fees, import, initdata, market, scoring, transfers | Presence does not establish passing tests or full acceptance coverage |

Scripts: `dev`, `build`, `build:dev`, `preview`, `lint`, `format`, `test`. No explicit `typecheck` script or `.github` workflow directory was found in this checkout. Establish a reproducible lockfile-based environment before running the code baseline.

## Priority findings for follow-up

1. **Scheduler authentication:** both public maintenance routes under `src/routes/api/public/hooks/` compare the supplied `apikey` with `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_ANON_KEY`. These identifiers are used as the route's sole credential. Replace with dedicated server-side authentication and test fail-closed behavior. Live exposure has not been tested.
2. **Webhook durability:** `src/routes/api/public/telegram/webhook.ts` awaits `handleUpdate`, catches errors and returns success. This does not demonstrate the spec's fast durable receipt plus asynchronous retry behavior. Audit deduplication and crash recovery together so retries neither lose nor duplicate effects.
3. **Session consumption:** `exchangeLoginToken` in `src/lib/session.server.ts` reads then updates a login token in separate operations. Review concurrent redemption and implement atomic consumption with expiry enforcement. Test forged, stale and future-dated `initData`, not just normal signatures.
4. **Credential documentation mismatch:** outgoing Telegram calls use the Lovable connector gateway with `LOVABLE_API_KEY` and `TELEGRAM_API_KEY`; `verifyInitData` separately needs `TELEGRAM_BOT_TOKEN`. The plan's gateway statement does not cover that actual requirement.
5. **Launch defaults:** `bruh-config.server.ts` defaults to mainnet, leaves direct asset tips enabled and enables its BRUH flag based on nonempty mint text. Audit all actual enforcement paths and align network, RPC, allowlist and explicit release gates before claiming launch readiness.
6. **Claims vs evidence:** later plans say Phases 0–6 are shipped while listing unfinished safety tests; current code has features those plans call missing. The mint guide calls fees built, but helpers are not a verified swap product. Build a requirements-to-code-to-test matrix before declaring completion.

These are source-based findings and audit priorities, not proof of an exploited production service.

## Configuration inventory (names only)

Observed server references include `LOVABLE_API_KEY`, `TELEGRAM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `APP_URL`, `SOLANA_NETWORK`, `SOLANA_RPC_URL`, `BRUH_TOKEN_MINT`, `FEE_BPS`, `FEE_TREASURY_ADDRESS`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_ANON_KEY`. Supabase integration files also require inspection for the complete client/server inventory. No secret values were requested or copied.

## Validation and next action

Documentation links, Git diff whitespace and the changed-file scope are checked for this documentation PR. Application tests, lint, build, live database checks and devnet transfers have not been run during this planning pass. No release readiness is claimed.

Next: establish the code baseline and implement the scheduler authentication slice described in [PROJECT_PLAN.md](PROJECT_PLAN.md), then durable webhook/replay controls. Work should first reconcile documentation and produce acceptance cases; Lovable should work from the resulting UI briefs.
