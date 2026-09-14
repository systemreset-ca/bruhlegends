# BRUH delivery and coordination plan

Created 2026-09-11. Status: proposed operating plan grounded in an initial repository inspection; not a completed security audit or launch certification.

## Product direction

Current owner updates: [one active wallet per Telegram account](decisions/0008-one-wallet-per-telegram-account.md) shared across groups, with private `/start` and `/wallet make/show/keys/destroy`; [tip-funded CHAD and future campaigns](decisions/0009-tip-funded-chad-and-future-campaigns.md), allocating 99% to the recipient and 1% to a CHAD purchase split equally between both wallets. These supersede older wallet-scope and illustrative fee economics for new implementation. Private account-wallet onboarding remains the next product priority. The [two-wallet devnet transfer](operations/2026-09-14-devnet-two-wallet-transfer.md) is finalized; persistent bot-wallet onboarding and rewards are not deployed.

The accepted [2026-09-13 grassroots addendum](decisions/0004-grassroots-participation.md) governs new participation and token-launch work: no presale or escrow, allocation points rather than fixed BRUH entitlement, bounded tester recognition, beta application fees off, and complete revision evidence. Its A–E milestones supplement the engineering slices below. Original files remain historical sources; no token economics or mainnet activation is implied.

BRUH should make a group's call history trustworthy and useful: capture a baseline, preserve attribution, measure performance transparently, resolve disputes, and let members voluntarily recognize a caller through a transfer to that caller's wallet in that group. The bot is the core product. The Mini App makes detailed workflows usable; the website explains and onboards.

The first usable release should stand on SOL/USDC tipping and credible call records. BRUH token acquisition/cash-out is a later, separately validated feature. Token launch should not block proving the bot's utility.

Improvements to evaluate with Work: show sample sizes and drawdowns beside winners; define treatment of invalidated, imported and illiquid calls; explain price freshness and unavailable prices; distinguish observed peak multiples from realizable returns; measure whether capped tip recognition still distorts rankings. Preserve existing scoring weights until a documented decision changes them.

## Shared project anchors

| Surface | Authoritative identifier | Responsibility |
| --- | --- | --- |
| GitHub | `systemreset-ca/bruhlegends`, integration branch `main` | Code, versioned specs, decisions, PRs and release evidence |
| Lovable | `e287f314-27c2-40bf-94f4-4685a95781fe` | Website/Mini App UI, presentation, preview and existing hosting integration |
| Codex | This repository checkout and PRs | Engineering lead, architecture integration, backend, data, tests and release verification |
| Work | Existing chat `Team Up Chats`, ID `6aa4ac53-4524-83e9-8141-5ba04d968c5a` | Research, requirements, documentation proposals and independent review |
| Website | `https://bruh.tips` | Public front; live deployment state remains to be verified |
| Telegram | `@BRUHLegendsBot` linked in preview | User says BotFather registration exists; runtime identity/config still to verify |

Chat handoffs are convenient transport. Accepted project decisions and evidence must be committed; a chat's claims do not establish that something was implemented or deployed.

## Source map and conflict handling

1. [Original preserved plan](../.lovable/plan/bruh-blockchain-recognition-utility-hub-2026-08-09.md): baseline Phases 0–4 and invariants. This matches the supplied attachment in substance and already has readable Unicode. Its references to spec sections 15 and 20 point to material not reproduced as numbered sections in that file; do not invent the missing text.
2. [Service-fee decision](../.lovable/plan/bruh-1-service-fee-buy-sell-2026-08-09.md): recorded choice of app-level 1% buy/sell fees, with no transfer tax; mint and treasury required. The original addendum was not preserved verbatim, so label any later consolidation as reconstructed.
3. Other `.lovable/plan/` files: historical implementation slices and brand decisions. Their completion claims must be checked against code and tests.
4. [Mint/liquidity notes](bruh-mint-launch-notes.md): explicitly external draft reference material.
5. [Mint setup guide](bruh-mint-setup-guide.md): a runbook for review that assumes additional locked choices. Reconcile those assumptions with recorded owner decisions before operational use. Do not execute it merely because it is present.
6. [Current evidence](AI_HANDOFF.md): dated inspection, gaps and next assignment.

When sources conflict, keep both historical records, explain the conflict, and resolve it in a new decision record. Existing code establishes current behavior, not automatically intended behavior. Current owner instructions can revise requirements; record those revisions. No silent replacement of original plans.

## Delivery sequence

| Slice | Owner | Work | Exit evidence |
| --- | --- | --- | --- |
| 0. Baseline and access | Codex, Work | Inventory actual code, migrations, secrets by name, deployment, bot identity, cron and documentation conflicts | Exact commit, requirements matrix, reproducible test/build baseline and runtime inventory |
| 1. Reliable and authenticated processing | Codex | Private scheduler authentication; durable webhook receipt/processing/retry; callback/session replay controls and group authorization | Adversarial authentication tests, duplicate/concurrent update tests, crash/retry tests; no lost or double-applied work |
| 2. Trustworthy calls and reputation | Codex, Work | Verify first valid caller, immutable baseline, pool identity, provider disagreement/failover, minimum samples, windows, milestones, disputes and imports | Provider fixtures and database integration tests including concurrency; scoring examples reviewed against spec |
| 3. Wallet and tipping validation | Codex | Group-specific ownership, nonce consumption, replacement delay, recipient snapshot, network/mint agreement, amount/reference matching and receipt idempotency | Two groups/two wallets tests; wrong/expired/reused payment proofs rejected; devnet end-to-end evidence |
| 4. Usable pilot | Lovable, Codex | Onboarding, group context, preview/confirm flows, wallet/tip screens, stale/error states, admin tools, truthful marketing and disclosures | Telegram mobile walkthrough, contract-compatible UI, rollback/pause exercise, pilot release record |
| 5. BRUH token extension | Work, Codex, Lovable | Reconcile token decisions; design and implement quote, acquire/cash-out, fee and swap verification | Approved spec, verified mint/pool/treasury configuration, tests, disclosures and separate release gate |

Slices 1–3 can reveal corrections to existing implementation; do not rebuild working modules just to match phase labels. No target launch date is asserted before the baseline and runtime checks.

## Revision workflow

1. Define one bounded task with an owner, source requirements, acceptance criteria and affected files.
2. Start from an exact GitHub commit. Use a named branch and keep PRs small. Lovable and Codex must not concurrently modify the same area without coordination.
3. For UI work, send Lovable the accepted contract and required loading/empty/error states. Backend and schema changes return to Codex for integration.
4. Work returns Markdown proposals with sources, dates, assumptions and acceptance cases. If Work lacks repository write access, Codex integrates its reviewed output. Do not make it invent access or claim to have edited files.
5. Each PR explains the problem, behavior change, spec/decision links, validation, migration/config impacts and rollback. Use explicit `not run` for missing checks.
6. Integrate after reviewing the latest `main`; preserve Lovable history. Record merge commit and verify the resulting preview/deployment independently. A merge is not evidence of publication.
7. Keep `docs/AI_HANDOFF.md` current and add short decision records under `docs/decisions/` as decisions occur. Record releases under `docs/releases/` when there is an actual release. Avoid duplicating the entire source specification into several drifting copies.

Suggested decision record fields: status, date, owner, question, alternatives, decision, reason, affected requirements, superseded decision, implementation PR. Suggested release fields: source SHA, deployment target/time, migrations, secret names changed, checks, remaining gaps and rollback.

## First engineering assignment

Establish the reproducible test/build baseline, then replace scheduler publishable-key authentication with a dedicated server-side credential and test rejection of absent, invalid and publishable credentials. Coordinate the scheduler configuration change with the endpoint deployment. Follow with a durable webhook state machine and atomic replay prevention. The inspection findings in the handoff provide the source locations.

## Information still to verify

- Which commit is deployed at `bruh.tips`, and whether the intended domain is configured for bot links and Mini App entry.
- Bot identity, group permissions/privacy mode, menu/command configuration, webhook health and scheduler jobs. BotFather registration alone does not establish these.
- Actual database migration application and RLS/grants; five local migration files are not proof of live database state.
- Availability of gateway credentials and the separate bot token required by the current HMAC implementation, without exposing values.
- RPC/network agreement and network-specific asset allowlist, plus devnet rehearsal and production security review required by the source plan.
- Mint/treasury and tokenomics decisions when the token phase is ready; none should be guessed.
