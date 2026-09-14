# Telegram-wide community and group rankings

Date: 2026-09-14. Owner clarification is effective immediately. Delivery: issue #60.

BRUH is a Telegram-wide reputation and tipping network. Best-in-group is one view; best-in-community is a primary product objective. Earlier wording that leaderboards/accounts/statistics must never aggregate across groups is superseded. Group isolation protects source attribution and scoped administration; it must not prohibit deliberate community aggregation.

One canonical Telegram account ID joins memberships across groups. Group call facts, locked baselines, seasons, moderation and tip attribution remain attached to their original group. One internal wallet per account/network remains shared. Derived community account rows combine eligible calls, call performance, confirmed tips sent/received, distinct tokens and contributing group counts. They do not average separate group scores or merge users by wallet address/display name.

## Initial implementation

Service-only aggregate RPC computes caller BRUH Score from combined source inputs using the existing scoring formula and minimum sample of three calls. Separate tipper ranking orders confirmed public tips sent. Windows: all, 7d, 30d. `/community [callers|tippers] [window]` and `/leaderboard global` work in groups or private chat; private `/leaderboard` selects the community view. Local `/leaderboard` in a group remains local. Authenticated community backend loader is supplied for a future owner/Lovable UI; no website presentation changes belong to this task.

Only eligible active/rugged/archived explicit/passive calls with valid baselines contribute. Imported, pending, quarantined and invalidated calls do not score. Membership must match the source group, must not be banned and must not have a forgotten pseudonym. A call ID contributes once; distinct groups can contain legitimate separate calls of the same mint. New cross-post/anti-farming deduplication policy is follow-up work, not silently invented here.

Tips require both confirmed intent and matching verified transfer. Deduplicate by network/signature; exclude account-level self-tips. Network windows use confirmation time. Public attributed tip activity contributes to public account ranking; existing private, anonymous and pseudonymous tip choices are retained rather than exposed as canonical-account activity. Hidden activity remains in source records for controlled internal accounting. Do not label devnet tip counts as mainnet usage.

## Data access

Aggregate RPC exposes canonical account display and counts/performance, not wallet addresses/keys, membership IDs, private chat IDs, group names or message content. No new direct table grants or RLS relaxations. Existing right-to-be-forgotten memberships are excluded from this named projection. Source history is not deleted or rewritten. Original Cloud role/admin trust limits remain.

## Milestones

1. Community caller/tipper account projections, bot commands, authenticated loader and acceptance tests.
2. Managed aggregate RPC application, actual role verification and live command acceptance/publication evidence.
3. Community group/token rankings and own overall stats/rank with stable pagination; common community season definition.
4. Reviewed cross-post, sybil and wash-tip controls, account-wide privacy controls and scale-driven caching/indexes.

This revision is separate from unfinished wallet authorization/signing. Account-tip execution must eventually feed the same verified-transfer attribution pipeline, so local and community counts reconcile without counting one transfer twice.
