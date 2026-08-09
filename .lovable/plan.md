# BRUH — Phase 6 slice + Phase 5 cleanup

Same methodology: server-only logic in `*.server.ts`, thin server-fn wrappers, group-isolated reads, every money path verified on-chain.

## Part A — Close out loose ends

1. **Digest announcements.** `announcement_mode` currently only supports `immediate` and `off`; `hourly`/`daily` silently drop messages. Queue pending announcements and flush them as one compact digest on the existing cron.
2. **Quiet-hours catch-up.** Milestones suppressed during quiet hours are lost today. Hold them and release when the window closes.
3. **Moderator management.** `/moderators add|remove|list` for group admins, writing `group_members.role`, so moderator powers no longer depend solely on live Telegram admin lookups.
4. **Pause / status.** `/pause`, `/resume` and `/status` (last refresh, provider health, open calls, pending tips, bot permissions) — the spec's admin health surface.
5. **Mini App `initData` validation.** Accept Telegram `initData` (HMAC-verified server-side) as a first-class entry path alongside the login-token link, so the app opens directly from the group without a round trip.

## Part B — Phase 6: Mini App depth

6. **Calls explorer + call detail.** Filterable list of a group's calls with status, baseline, current multiple, peak; detail view shows the timeline of observations, milestones hit, disputes and the caller.
7. **Member profile.** BRUH Score breakdown by component (performance, consistency, early discovery, recognition, reliability), call history, tips sent/received under the member's privacy mode.
8. **Tip composer.** Pick recipient from group members, asset, amount with live USD estimate, privacy mode, then the existing Solana Pay QR flow — instead of requiring the `/tip` command.
9. **Admin console.** One page combining settings, seasons, disputes, moderators, pause switch and provider status.

## Part C — Compliance and data rights

10. **Policy pages.** `/privacy`, `/terms`, `/risk` routes with the spec's disclosures; linked from the bot's `/privacy` reply and the Mini App footer. No profit or "earn by holding" language.
11. **Data deletion + export.** `/export` produces a group CSV (calls, milestones, leaderboard) for admins; members can request deletion of their own data, which anonymises their membership while preserving group history integrity.

## Part D — Verification

12. **Automated tests** for the highest-risk acceptance cases: cross-group wallet isolation, first-caller wins, duplicate `update_id` ignored, duplicate observation cannot double-fire a milestone, forged `initData` rejected, nonce reuse rejected, expired intent uncountable, and wrong recipient/mint/amount/reference failing verification.

## Technical notes

- Digest queue is a new `pending_announcements` table (group, kind, payload, released_at) with GRANTs, drained by the existing 2-minute cron; no new scheduler.
- `initData` validation uses the bot token via the Telegram connector-derived secret, HMAC-SHA256 per Telegram's spec, with a freshness window; `initDataUnsafe` is never trusted.
- Deletion is anonymisation, not row removal: `group_members` keeps the row, clears display name/pseudonym, revokes wallets, and detaches `telegram_users`.
- CSV export is generated in a server function and returned as a download; no raw provider payloads included.
- Tests run under Vitest against pure server-lib functions with a stubbed database client — no live Telegram or RPC calls.
- Swap routing / BRUH acquire flow stays out of this slice until the mint exists.
