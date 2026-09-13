# Participation ledger and bounded follow-up processing

Date: 2026-09-13. Status: implementation proposal for [issue #36](https://github.com/systemreset-ca/bruhlegends/issues/36), governed by [grassroots decision](0004-grassroots-participation.md). No economics or earning activation approved by this record.

## Behavior

Group-scoped participation seasons store immutable rule versions, six configurable activity weights, UTC daily/member/pair/tester caps, season budget, network and approval-record reference. Every season starts draft. No season or weight is seeded by the migration. Only service-controlled functions create seasons and change status; activation requires an approval record and nonzero rules. Closed seasons cannot reopen; changing rules requires a new version/season.

Awards accept server-verified source IDs, never a client-supplied point quantity. Tips require confirmed intents and matching unique receipts with signature, slot, recipient, mint, amount, network and season window. Mainnet activity cannot be substituted with devnet faucet volume. Devnet earning supports only independently reviewed, capped tester recognition. Calls require an independently reviewed active, non-imported call; referrals require a reviewed installed group; tester recognition requires a reviewed evidence ID. These review functions are service-only, not public Mini App APIs. No automatic call/referral/tester approval is implemented.

Award decisions lock the season and deduplicate sources. Active-day recognition deduplicates by member and UTC date even when multiple tips occur. Same member/user/wallet recognition is excluded, including during wallet replacement cutoffs. Banned and opted-out participants cannot earn. Caps use gross awarded points: an audited reversal reduces allocation weight without reopening earning capacity. Exceeded caps create immutable held zero-point records; retry returns the original outcome. Holds do not automatically convert into awards.

Reversals require a same-group administrator/moderator, an idempotent request ID and a restricted reason code; they append a negative adjustment rather than editing history. Points, reviews and rule history reject update/delete. User-facing reads expose only the caller's group/member history and no counterparty/actor identifiers.

## Durable tip jobs and costs

Receipt/status triggers enqueue a unique job only when a mainnet confirmed receipt matches an active season. No active season means no job. The existing authenticated `verify-tips` route drains up to 20 jobs per request after tip verification. Each tip can recognize sender, recipient and their active day; all its point writes roll back together on failure. Jobs retry with exponential delay at most five times, then remain visible as needing review. Only SQLSTATE is retained, never error text, credentials or provider URLs. An explicit service retry is audited.

The job worker performs database work only: no Helius calls and no Telegram sends. Do not add another cron job or increase cadence. After deployment, extend only the existing `bruh-verify-tips` database predicate to include due pending participation jobs; empty work still means no outbound HTTP. Keep the existing scheduler secret, route and cadence. Jobs for different seasons are selected in season order before acquiring season locks to reduce cross-season deadlock risk. Multi-session contention still requires independent validation.

## Access, rollout and privacy

All four tables have RLS, deny client policies and explicit grants. PUBLIC/anon/authenticated have no table access or function execute privileges. Service role has SELECT only on the new tables; sensitive writes use SECURITY DEFINER functions with fixed search_path and qualified table references.

`BRUH_PARTICIPATION_STORAGE_ENABLED` is a server-only deployment gate, unset/false by default. Disabled application reads never query the new schema; disabled workers do nothing. Apply and verify the migration before enabling storage. This flag does not create or activate a season. No RPC key, wallet key or new account is required. Mainnet and BRUH token release gates remain unchanged.

Authenticated Mini App reads resolve Telegram session ownership before deriving the group from membership. Group `/credits` uses its authenticated update context. Recent history is bounded to 50 entries; totals cover the complete membership ledger. Show pending/dead job counts separately from awarded points. Database failures are errors, not zero balances. Export includes the member's participation entries; forgetting sets participation opt-out and preserves pseudonymous audit history. Final allocation must exclude opted-out identities and require verified wallet ownership; allocation/distribution is not implemented here.

Migration source: Supabase `20260913140000_participation_ledger.sql`. The managed rollout replaced Drizzle `0014_participation_ledger.sql` with its no-op placeholder after a filename collision and applied `0014_participation_ledger_managed.sql` instead; the latter matches the authoritative SQL except final newline. Preserve both journal records as applied history; see [Cloud source/access evidence](../operations/2026-09-13-participation-cloud-rollout.md). Filename 0013 remains reserved by unapplied PR #32; reconcile the Drizzle journal chronologically before integrating that proposal, so its older timestamp is not skipped. Generated blank Drizzle schema and platform Supabase types are not manually rewritten.

## Evidence and limits

Tests execute the actual SQL in isolated PGlite PostgreSQL, with rollback after every fixture. Coverage includes rules, receipt matching, duplicates, caps, reversal immutability, tester limits, group boundaries, permissions, audit failure, queue idempotency, worker rollback and bounded retries. PGlite uses one connection; these tests do not prove competing-session locking. Cloud application/grants, mobile authenticated journey, new scheduler predicate and actual devnet/mobile transaction evidence must be recorded separately. No reward token, airdrop, mint, fee or mainnet activation is part of this slice.
