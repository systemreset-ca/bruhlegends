# Scheduler load reduction — 2026-09-12

- Source commit: `d43fc84203a6b81baa410db0e6a4b3fe2b3a7bbd`
- Surface: connected Lovable Cloud project `e287f314-27c2-40bf-94f4-4685a95781fe` and its Supabase database
- Operator: Lovable, directed by Codex under owner authorization
- Production deployment: not performed

## Code change

The tip-verification route now performs only tip verification and confirmed-tip announcements. Due announcement digests and expired one-shot credential cleanup moved to the protected hourly maintenance route. Raw provider and Telegram payload retention moved to the protected daily pruning route.

Outgoing Telegram delivery also enforces process-local per-chat spacing and honors Telegram `retry_after` responses. This is one layer of rate protection; it is not a distributed limiter across multiple application processes.

## Active jobs

| Job | Schedule | Type | Idle behavior |
| --- | --- | --- | --- |
| `bruh-refresh-calls` | `*/15 * * * *` | Conditional HTTP | Calls the app only while an active or quarantined call exists |
| `bruh-verify-tips` | `*/2 * * * *` | Conditional HTTP | Calls the app only while a created or awaiting-payment tip exists |
| `bruh-process-telegram-updates` | `* * * * *` | Conditional HTTP | Calls the app only for ready, retryable or expired-lease webhook work |
| `bruh-maintenance-hourly` | `0 * * * *` | HTTP | Always runs hourly |
| `bruh-prune-retention` | `17 3 * * *` | HTTP | Always runs daily |
| `bruh-prune-cron-history` | `31 3 * * *` | SQL only | Deletes job-run history older than 14 days; leaves job definitions intact |

All HTTP jobs read the existing `BRUH_SCHEDULER_SECRET` from Supabase Vault at run time and send it in `X-BRUH-Scheduler-Secret` with `Content-Type: application/json`. Lovable reported that the same unchanged secret remains present in its server secret store. Its value was not read out, displayed or committed.

## Verification

Lovable observed a bounded interval with all three work predicates false. Three conditional cron runs completed successfully and produced zero new `pg_net` outbound requests.

Safe one-off requests against the synchronized preview returned HTTP 200:

| Route | Redacted-safe response |
| --- | --- |
| `/api/public/hooks/maintenance-hourly` | `{"ok":true,"digestGroups":0,"digestsSent":0}` |
| `/api/public/hooks/prune-retention` | `{"ok":true,"groups":0,"prunedObservations":0,"prunedWebhookUpdates":0}` |
| `/api/public/hooks/refresh-calls` | `{"ok":true,"refreshed":0,"quarantined":0,"milestones":0,"announced":0,"queued":0}` |
| `/api/public/hooks/verify-tips` | `{"ok":true,"checked":0,"confirmed":0,"expired":0,"announced":0,"queued":0}` |
| `/api/public/hooks/process-telegram-updates` | `{"ok":true,"claimed":0,"processed":0,"failed":0,"deadLettered":0}` |

With empty work queues, scheduled application invocations are 25 per day: 24 hourly maintenance calls plus one daily retention call. That is about 750 invocations per 30 days, down from 73,440 unconditional invocations under the previous schedules. Minute-level database predicate checks still run inside Supabase and create cron run-history entries, which the daily SQL job limits to 14 days.

## Verification limits

These empty-work checks verify scheduler authentication, routing, job predicates and idle suppression in the connected preview. They do not verify a real Telegram update, a market-data request, a Solana devnet transfer, production-domain routing or production database binding.
