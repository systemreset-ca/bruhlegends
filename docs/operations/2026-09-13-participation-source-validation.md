# Participation ledger source validation

Date: 2026-09-13. Branch: `codex/participation-ledger`. Base: `bb174fe52c4d68a14e4585054c023d282ba44fef`. Tracking: [issue #36](https://github.com/systemreset-ca/bruhlegends/issues/36). Governing [decision/runbook](../decisions/0005-participation-ledger.md).

## Verified locally

- 105 Vitest application tests pass across 16 files.
- Strict TypeScript passes.
- Changed-file ESLint passes with zero errors; existing `any` warnings remain.
- Production build passes; existing TanStack/path-plugin/bundle warnings remain.
- 20 isolated PostgreSQL tests execute the actual migration with rolled-back fixtures: awards/retries, verified receipts, caps, immutable history, reversals, tester recognition, ACLs, queueing, worker rollback and bounded retries.
- Supabase/Drizzle SQL copies are identical; diff whitespace check passes.

The database dependency is pinned in the isolated tool package, with its own lockfile. Application dependencies/Bun lock are unchanged. Node `.pg.mjs` tests are separate from Vitest discovery.

## Not yet verified

Cloud application and effective access; competing PostgreSQL sessions; storage flag; existing cron predicate extension; authenticated mobile history; live bot delivery; publication. No season, economics, tokens, fees, rewards, mainnet gate or treasury transaction is enabled by this source.

## Rollout

Merge after exact-head review. Apply only the participation migration and inspect all four tables, functions and trigger privileges. Keep zero earning seasons. Enable the server storage flag only after successful schema/access verification. Extend only `bruh-verify-tips`'s existing conditional predicate to include due pending jobs; preserve cadence and scheduler credential. Verify empty predicates make no HTTP requests. Build/preview the resulting exact source before publication. Record any platform-managed journal/type-generation changes separately and verify them.

Rollback application through a new revert/publish. Disable storage and pause seasons to stop processing; retain tables/events/audits rather than deleting history. Mainnet activation remains a separate gate; PR #32 is not included.
