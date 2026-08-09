# BRUH — Phase 5 build slice + Phase 0–4 cleanup

Continue the same methodology: server-only logic in `*.server.ts`, thin server-fn wrappers, group-isolated data, non-custodial on-chain verification.

## Part A — Close out Phase 0–4 loose ends

1. **Tip payment UX in the Mini App.** Today a `/tip` creates an intent and returns a Solana Pay link; there is no in-app pay screen. Add a `/app` tip panel that lists the user's pending intents, renders the Solana Pay QR (qrcode is already installed), shows amount/asset/recipient/expiry, and a "I've paid" button that calls confirm.
2. **Automatic tip confirmation.** `confirmTip` only runs when someone asks. Add a scheduled hook (`/api/public/hooks/verify-tips`) that sweeps `tip_intents` in `awaiting_payment`, verifies on-chain by reference key, writes `verified_transfers`, expires stale intents, and posts the group announcement honouring the tip privacy mode.
3. **Expiry sweep.** Mark expired tip intents, wallet challenges, login tokens and mini-app sessions as expired/cleaned in the same job.
4. **Announcement quiet hours / batching.** `groups.announcement_mode` and `quiet_hours_start/end` exist but are ignored. Respect them for milestone and tip announcements.
5. **Chat migration + bot removal.** Wire `migrateChatId` to the `migration_to_chat_id` update and set `groups.removed_at` on `my_chat_member` kick/leave; stop announcements for removed groups.
6. **Tip privacy.** Honour `default_tip_privacy` and per-tip privacy (public / pseudonymous / anonymous / private) in every announcement and leaderboard surface.

## Part B — Phase 5: moderation, disputes, seasons

7. **Disputes.** `/dispute <call>` currently only records. Add moderator resolution (`/resolve <id> uphold|reject <note>`), which can invalidate a call and recompute scores; expose an open-disputes list in the Mini App for moderators only.
8. **Seasons.** `/season start <name>`, `/season end`, `/season list` for admins. New calls attach to the active season; leaderboards get a season selector (season vs all-time).
9. **Group settings surface.** Admin-only settings page in the Mini App for detection mode, min liquidity, min token age, repeat calls, announcement mode, quiet hours, retention — mirroring the existing chat commands.
10. **Retention job.** Apply `raw_message_retention_days` by pruning raw payloads in `market_observations.raw` / `audit_events` beyond the window.

## Part C — BRUH token readiness

11. **Asset registry.** Populate `supported_assets` with SOL and USDC enabled, BRUH row present but `enabled = false` until `BRUH_TOKEN_MINT` is set; drive tip asset validation from that table instead of hard-coded constants.
12. **Swap intents stay stubbed.** `swap_intents` / `verified_swaps` tables exist; no swap routing is built in this slice — flagged as a later phase so we don't ship an unverified router.

## Technical notes

- New scheduled endpoint follows the existing `refresh-calls` pattern (shared-secret header, `pg_cron` every 2 minutes for tips).
- Score recomputation after dispute resolution reuses `scoring.server.ts`; no schema change needed.
- Mini App additions reuse the existing session-hash auth, so all new reads/writes stay group-scoped.
- One migration: seed `supported_assets`, add indexes on `tip_intents(status, expires_at)` and `calls(group_id, season_id)`, plus GRANTs — no table exposed directly to the Data API.
- No custody, no keys: every new money path still ends in a user-signed transaction verified on-chain.
