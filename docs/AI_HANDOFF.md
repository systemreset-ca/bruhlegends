# BRUH current handoff

## Existing-wallet Mini App status fix — source ready

The first published Mini App onboarding screen could resolve an existing encrypted wallet but then
failed while directly reading `bruh_secure_action_credentials`, whose table grants are intentionally
revoked from `service_role`. The follow-up replaces that read with a `SECURITY DEFINER` boolean RPC
available only to `service_role`; salts and hashes remain inaccessible. Apply managed migration 0022,
publish the reviewed commit, then have the owner open a fresh private `/start` Mini App link. See
[implementation record](operations/2026-09-14-existing-wallet-status-fix.md).

## Published account-tip backend — current status

[Publication evidence](operations/2026-09-14-account-tip-backend-publication.md): original project published reviewed `5d5f171e34beca103ba852e7d234cc7a27ec98f6` after 173 tests/types/build, exact managed migrations 0018–0021, role checks and configured Helius devnet read. Tip/signing gates are enabled on devnet; new private-action route is HTTP 200 and unauthenticated webhook POST 401. Real-user private /security setup and funded-tip/finalized-history/community acceptance remain pending. Keep mainnet and unfinished export/withdrawal/retirement/token features disabled.

## Current account-tip integration

[Backend deployment and pilot controls](operations/2026-09-14-account-tip-pilot-controls.md): PR66 authorization/signing and PR67 atomic history/community credit passed public CI; original Cloud applied 0018–0020 with managed tests/types/build and role evidence. Devnet spending gates remain off. The next source adds bounded receipt checks and accurate bot instructions, then managed controls/activation/publication and real private Telegram password/funded-tip acceptance. No landing marketing edits.

## Account-tip authorization — current source integration

[Authorization and constrained execution](operations/2026-09-14-account-tip-authorization.md) adds separate password enrollment/attempt controls, one-use intent grants, exact SOL signing, signed-before-broadcast recovery, sender-only private bot links and the functional wallet-action screen. Proposed tip/auth schemas remain unapplied and spending gates remain disabled. Managed deployment, legacy tip/community credit integration and real Telegram acceptance remain required. Landing marketing is untouched.

## Account-tip preparation — source slice

[Internal preparation](operations/2026-09-14-account-tip-preparation.md) now validates group/membership context, resolves stored account wallets, builds an exact referenced SOL message, reads finalized blockhash/message fee/balance and reserves fee-inclusive funds. Sender-scoped request lookup returns existing intents without another quote and rejects changed requests. Proposed schema remains unapplied; no bot/route/worker caller, signing or broadcast. Independent secure-action authentication and durable execution remain next. No website edits or spending gate activation.

## Twelve-account isolated exercise

Fresh owner-funded execution now completed: 12 encrypted wallets, 48 synthetic calls, 11 finalized devnet funding transfers and 24 finalized verified tips; community caller/tipper rows each contain 12 accounts with two sent/two received tips. [Funded proof and all transaction links](operations/2026-09-14-twelve-account-devnet-funded-proof.md) supersede the earlier funding blocker below. Total network fees 0.000175 devnet SOL. Actual Telegram authentication and production spending are still outside this test; no Cloud seeds, website edits or gate changes.

Owner-authorized [exercise](operations/2026-09-14-twelve-account-devnet-exercise.md) generated 12 encrypted internal wallets plus external public candidates, verified 48 synthetic calls across three groups and 24 explicitly synthetic tip proofs in actual community SQL. Fourteen wallet/routing/group-scoring tests passed; local aggregate checks are included in public CI without network/report writes. Live harness plans 11 funding transfers and 24 referenced tips, but single public/Helius faucet attempts refused funding. No live transaction success is claimed. Original Cloud data, website and spending gates are untouched; Telegram identities/authentication and production spending are not exercised by this harness.

## Community-wide rankings — corrected core scope

Owner clarified that Telegram-wide community rankings are a primary feature alongside local group rankings. [Decision 0011](decisions/0011-community-and-group-rankings.md) supersedes older group-only aggregation restrictions. Account-keyed caller/tipper RPC, `/community`, `/leaderboard global` and authenticated community loader are now applied in Cloud and published from reviewed main `7fdbb0712e677ffc0212b8e654f3ba50aac200d2`; [publication evidence](operations/2026-09-14-community-leaderboard-publication.md) records completed Publish, passing managed tests/types/build/CI, live service counts and public route checks. Actual Telegram reply acceptance remains pending. Source facts remain group-attributed, wallets account-wide, named community tips public/verified/deduplicated by network/signature. Issue #60 tracks remaining group/token boards, cross-post controls and overall own-rank pagination. No Codex website edits or spending activation.

## Account-tip reservation and reconciliation — source slice

New proposed account-tip storage freezes account wallets/group/amount/reference/fee, serializes one pending spend per wallet, persists signed bytes, disallows signed cancellation and settles idempotently through exact finalized Helius proof. [Implementation and limits](operations/2026-09-14-account-tip-state-machine.md). Local 9 targeted tests and isolated SQL validation passed. Schema is unapplied, no live caller and spending gate remains disabled. SAP/spending authorization, simulation/signing/broadcast/recovery and existing tip/leaderboard integration remain next. No website files were edited; AGENTS records the owner's explicit presentation boundary.

## Owner publication confirmation — current

Owner reported published on 2026-09-14 in the original project. Independent GET `/` and `/app` returned 200; unauthenticated POST `/api/public/telegram/webhook` returned 401. GitHub main at confirmation was `fdae123f781867dddfe33b0881da09a813395c77`; exact deployed SHA could not be independently inspected because Lovable browser control still timed out. See [publication evidence and limits](operations/2026-09-14-owner-wallet-publication.md). Earlier publication-blocked statements below describe the prior state. Authenticated wallet command acceptance and SAP/spending/export remain pending.

## External wallet Cloud rollout — applied, publication blocked

PR #56 merged as `73a12d3283127c919c238bdcad5ca2b289957764`; Lovable applied managed migration 0016 and regenerated types at `e84c185c88b1ce8ff381d9de5be70965fbf54d09`. Codex reviewed the diff against the proposed SQL; only outer transaction delimiters were omitted. [Cloud evidence](operations/2026-09-14-external-wallet-migration.md) reports RLS/FORCE RLS, service-only RPC access, 137/137 tests, types and production build passing. Exact revision CI [34830646065](https://github.com/systemreset-ca/bruhlegends/actions/runs/34830646065) passed. No new projects/secrets or user rows. Publication is pending: browser control timed out on both original and fresh original-project tabs, including reload. Last verified published code remains `3565b61b67be82db8e699b485adc18c2655db384`. No additional authorization is needed; restore browser connectivity, confirm exact build and publish. External candidates remain unverified; SAP, ownership verification and spending remain unimplemented.

## Account external address commands — source ready

Private `/generate` now creates/reuses the internal wallet. `/wallet add <public-address>` and `/wallet external` register/read a distinct account-wide **unverified candidate**, not an ownership-verified withdrawal destination. Replacement, withdrawals and exports remain blocked. Local 14 command/service/link tests, TypeScript and isolated SQL validation passed. Cloud schema and publication are pending; see [implementation evidence](operations/2026-09-14-external-address-commands.md). Earlier statements that external registration is absent describe the prior revision; ownership verification and SAP remain unimplemented.

## Wallet security reference — current owner direction

Follow [decision0010](decisions/0010-trojan-wallet-security-reference.md): Trojan's documented generated-wallet, deliberate export and separate Secure Action Password flows are the product/security reference. Adopt standard implementation components; do not claim identical undisclosed backend security. SAP-sensitive actions and the new account-wide external withdrawal destination are not implemented. Preserve one internal wallet, no imported user keys, private protected export, group-scoped statistics and current devnet gates. The reference comparison records actual existing gaps and recovery requirements.

## JEETER revision and next devnet receipt slice

Owner accepted JEETER **9 decimals** on 2026-09-14; decision 0009 now supersedes its earlier 16-decimal proposal. Mint/supply/campaign activation remain unresolved. The source-only [devnet receipt foundation](operations/2026-09-14-devnet-tip-receipt-foundation.md) validates exact sender/recipient/amount/reference and fee-aware balance changes through bounded finalized devnet reads. It is not wired to signing, spending or settlement; durable intent/reservation/idempotency work remains next. The published wallet release below is unchanged and the owner's two-account private command check is still pending.

## Current published private account wallets

Published exact `3565b61b67be82db8e699b485adc18c2655db384` in the original project to `bruh.tips`. The creation gate is enabled on devnet; managed schema and actual privileges are recorded, 126/126 managed tests and exact main CI passed, publication completed and public routes were independently checked. See [publication evidence](operations/2026-09-14-devnet-wallet-publish-3565b61b.md). Private `/start` creates/reuses one encrypted account wallet; `/wallet make` confirms and `/wallet show` reads its balance. Spending/export/retirement remain unavailable and tips are blocked in this mode. Owner's actual two-account private command check remains pending. Platform-role BYPASSRLS and shared-worker trust are explicitly recorded. Earlier source-only/unapplied/unpublished statuses below are historical.

## Private account-wallet implementation slice

Original-project source now implements gated private `/start` creation, confirmed `/wallet make`, authenticated `/wallet show` and bounded Helius devnet balance reads. Export, retirement and bot-wallet spending remain explicitly unavailable. The proposed SQL is not applied; persistent key/config and Cloud privileges are not yet validated. See [implementation and rollout evidence](operations/2026-09-14-private-account-wallets.md). Do not merge the obsolete per-group custody migration as a shortcut.

## Account-wallet and reward revisions — current

The original BRUH project's disposable-wallet test completed a finalized 0.001 SOL transfer using its devnet configuration. See [public execution evidence](operations/2026-09-14-devnet-two-wallet-transfer.md). This is a CLI experiment, not persistent Telegram wallets. Decision [0008](decisions/0008-one-wallet-per-telegram-account.md) selects one active wallet per Telegram account shared across groups; calls/stats/attribution stay chat-scoped. Guardian is not a requested product or enabled dependency. Decision [0009](decisions/0009-tip-funded-chad-and-future-campaigns.md) records 99% recipient proceeds and a single 1% CHAD purchase split equally, with future JEETER/lock-bonus/HAKTUAH campaigns inactive. Exact base-unit source calculators do not execute swaps or award rewards. Earlier dated custody-scope/provider sections are historical and must not override these updates.

## Current published application — 2026-09-13

Published exact `152f5baa16f269871ebbebd521ff2fdf7760b1db` to `bruh.tips` using Lovable Publish. Exact-source main CI and managed preview passed; local/preview 107 tests and 20 isolated SQL tests pass. Public routes returned 200 and unauthenticated webhook 401. See [release evidence](operations/2026-09-13-production-publish-152f5baa.md). GitHub is PUBLIC with preserved history and passing pinned validation. Participation storage/schema is configured but zero seasons/awards; authenticated ledger/mobile journeys, owner-signed two-account devnet tip and multi-session concurrency remain unverified. Issue #41 tracks unapproved economics/anti-farming gates. No new secrets needed. PR #32, funded rewards, mint and mainnet remain separate/gated. Earlier sections are historical.

## Cloud participation and public CI — 2026-09-13

Ledger PR #38 and public validation PR #39 are merged. GitHub is now public with anonymous access verified and the first locked public CI run passing. Managed Cloud ledger source is `b17d54c550a8fb4ef513953612bd9b1d61dac787`; schema access and the existing conditional scheduler were verified by Lovable, storage configured, zero seasons/awards. Preserve the original no-op journal entry and applied managed SQL duplicate. A follow-up isolates the inactive credits test from Cloud configuration and prevents points-RPC outages blocking confirmed-tip announcements. See [rollout evidence and limits](operations/2026-09-13-participation-cloud-rollout.md). Application publication is still pending; PR #32 and mainnet remain separate/gated. Statements below describe earlier dated states.

## Participation ledger implementation — 2026-09-13

Branch: `codex/participation-ledger`, source baseline `bb174fe52c4d68a14e4585054c023d282ba44fef`. Implements issue #36: immutable rule seasons, audited awards/holds/reversals, reviewed activity sources, durable bounded tip jobs and authenticated history. See [ledger decision/runbook](decisions/0005-participation-ledger.md). Storage is gated by `BRUH_PARTICIPATION_STORAGE_ENABLED`; no seasons/economics are seeded. Exact validation and submitted SHA belong in the PR. Cloud schema application, storage gate, predicate update and deployment are not yet verified. The earlier foundation is the recorded deployed application. PR #32 remains separate and unapplied.

## Current direction and review slice — 2026-09-13

Published application source is now `1d458ffcfdb8aff1b3b21aa8083bcb8253f85416` (PR #35). See [publication evidence](operations/2026-09-13-production-publish-1d458ffc.md): Lovable completion, revised public token page/homepage 200, unauthenticated webhook 401. Earning stays off; personal ledger and authenticated/live command checks are not complete. GitHub milestones A–E and ledger issue #36 are created. Earlier baseline/deployment statements below are historical.

Accepted owner direction: [grassroots participation](decisions/0004-grassroots-participation.md). No presale/escrow; allocation points, capped tester recognition and preserved revision history. This review slice adds inactive `/credits` and Mini App status screens and replaces outdated token-page mint/fee promises. No earning ledger, rewards, token, mainnet gate or Cloud migration is enabled. Source baseline: `275a60e9d892581b0476ada2d6d8739dfa1f6b28`; branch `codex/grassroots-participation`. Validation and exact submitted SHA are recorded in the PR/operation record. The pending settlement branch and its unvalidated Cloud function remain separate. Public repository visibility and history-safety review are pending.

Next implementation: append-only participation ledger with atomic uniqueness/caps, approved versioned rules, group-scoped reads and privacy integration. Earning remains off until weights, caps and eligibility are approved. Before mainnet, complete the outstanding two-account devnet flow and settlement validation. See the A–E milestones in the addendum.

Inspection date: 2026-09-12 (America/Toronto).
Code baseline: `main` at `a8e43662d7613cb69de4cd2c2dc52530dc2a19d7`.
Production application baseline: `a8e43662d7613cb69de4cd2c2dc52530dc2a19d7`.
Implementation branch: none; the release candidate is merged and published.
Scope: operate the verified Telegram fast path and Solana devnet safety gate, then complete one controlled user-signed devnet SOL tip. No secret value is included.

## Access and context

- Existing GitHub CLI login reports `ADMIN` for private `systemreset-ca/bruhlegends`; clone succeeded. The separate GitHub connector returned 404, so CLI and connector access must not be conflated.
- Lovable published exact GitHub `main` commit `a8e43662d7613cb69de4cd2c2dc52530dc2a19d7`. The public homepage and token page returned HTTP 200, the corrected devnet copy was present, and an unauthenticated webhook POST returned HTTP 401. A real private-chat `/help` completed inline in about 2.71 seconds with first-attempt processing and delivery, no error and no scheduler fallback. See the [devnet safety publish](operations/2026-09-12-production-publish-a8e43662.md), [immediate fast-path rollout](operations/2026-09-12-telegram-immediate-fast-path.md), and [durable outbox rollout](operations/2026-09-12-telegram-outbox.md).
- Read the owner's pasted attachment, the original plan, fee plan, mint notes/setup guide, later phase plans, repository instructions and existing Work chat `Team Up Chats`.
- GitHub is the shared authority; Codex leads engineering/integration, Lovable handles UI, Work handles research/documentation proposals. See [delivery plan](PROJECT_PLAN.md) and [Work brief](WORK_CHAT_BRIEF.md).

## What exists in source

| Area     | Evidence                                                                                                                                                      | Verification limit                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack    | `package.json`: TanStack Start `1.168.32`, Router `1.170.18`, React `^19.2.0`, Vite `^8.2.0`, Supabase JS `^2.112.2`, Vitest `^4.1.10`; `bun.lock` present    | Manifest constraints, not installed/resolved version verification                                                                            |
| UI       | `src/routes/app.tsx`, marketing/group/token/tiptek routes, policy routes and brand components                                                                 | Preview observed; complete user journeys not tested                                                                                          |
| Bot      | `src/lib/bot.server.ts`, `telegram.server.ts`, public webhook route                                                                                           | Live `/help` processing and reply verified; broader command journeys remain unverified                                                       |
| Backend  | Calls, market, scoring, wallets, tips, Solana, moderation, imports, announcements, data rights, Mini App and session modules under `src/lib/`                 | Initial selective reading; not a complete audit                                                                                              |
| Database | Twelve migrations under `supabase/migrations/`; generated types; RLS statements present                                                                       | The repository Drizzle journal records eleven entries through Lovable's semantically identical managed duplicate `0010`                      |
| Market   | `market.server.ts` includes DexScreener and Jupiter, cross-check and fallback                                                                                 | Historical Phase 7 missing-provider statement is stale; live API support unverified                                                          |
| Fees     | `fees.server.ts` has split/quote/record/confirm/report helpers, plus migration/tests                                                                          | Search found fee record/confirmation definitions without an integrated application swap caller; do not describe complete buy/sell as shipped |
| Tests    | Twelve files including scheduler authentication, tip-scope, asset allowlisting, network release gates, Telegram `initData` and queue/outbox adversarial cases | 78 tests pass locally; database and live-provider integration coverage remains incomplete                                                    |

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
