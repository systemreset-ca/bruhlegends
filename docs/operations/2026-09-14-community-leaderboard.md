# Community leaderboard implementation and rollout

Owner correction is effective under [decision 0011](../decisions/0011-community-and-group-rankings.md), tracked in [issue #60](https://github.com/systemreset-ca/bruhlegends/issues/60). Source baseline `05c946fd49bf9e8e53ccc34146a4cbc38c0e6d79` includes the latest owner/Lovable website changes. This implementation edits backend, bot commands, tests and GitHub records only.

## Delivered source

- Controlled `bruh_community_leaderboard` RPC joins canonical Telegram account IDs across group memberships; computes overall caller score from combined eligible calls, milestones and verified public tip counts. Separate tipper ordering uses tips sent. No averaging of local scores.
- Call records, immutable baselines and group attribution remain unchanged. Group leaderboard remains local; group pause/banned-member command controls are preserved.
- `/community [callers|tippers] [7d|30d|all]`, `/leaderboard global [kind] [window]` and private `/leaderboard [window]` select community ranking.
- Aggregate DTO includes account display, calls/performance, distinct token count, confirmed public tips sent/received and contributing group count. Explicit server projection drops any additional RPC fields, preventing accidental exposure of wallet/group source data.
- Authenticated `getCommunityBoardFn` supplies the account-wide view to future owner/Lovable presentation without a membership selector or client-supplied identity. No website/UI was edited.

Only public matched verified transfers count; deduplicate network/signature and reject canonical-account self-tips. Failed/pending/unverified tips do not contribute. Hidden tip settings remain respected. Calls require valid source/baseline/status and group-member consistency; forgotten/banned memberships are excluded. Imported, quarantined and invalidated calls cannot score. Calls use creation-time windows; tips use confirmation-time windows. Tip network follows configured devnet/mainnet-beta independently of recorded Solana market calls.

## Validation and limits

Local community-reader and existing scoring tests: 10 passed. Bot-routing tests: 3 passed; strict TypeScript passed after command changes. Isolated PostgreSQL aggregation test passed: one canonical account across two groups, combined sample/performance/milestones, stable sample ordering, distinct signatures, privacy, self-tip, imported/invalidated/forgotten/banned/group-mismatch exclusions, confirmation windows, network separation and service-only grants. Additional session-auth tests and final full CI results belong in the PR.

One database read per ranking command; no AI, Helius calls, scheduler, retry polling or broadcast is added. Top results are limited to 100 (bot uses 10), but SQL computes against the full eligible source set rather than silently truncating records to a client page. Scale-driven aggregate indexes/caching remain future work.

## Cloud rollout — pending

`docs/proposed-community-leaderboard.sql` must be applied as a new managed migration, preserving journals/history and omitting outer transaction delimiters only when the runner wraps the migration. No new tables/direct grants or RLS changes are required. Verify EXECUTE is service-only and no source table access is exposed to anon/authenticated. Record platform-role limits honestly. Original project only; no secrets/accounts or website changes.

Browser control of the original Lovable tab still timed out during this task. Schema application, exact managed build/publication and real bot replies remain unverified. A missing RPC returns an explicit unavailable reply, never a fabricated leaderboard. No wallet spending activation or receipt-to-legacy-tip integration is implied.
