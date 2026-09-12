# Telegram immediate fast-path rollout

Operation date: 2026-09-12 (America/Toronto).
Cloud project: Lovable project `e287f314-27c2-40bf-94f4-4685a95781fe` and its connected Supabase database.
Feature merge and production commit: PR #21, `67f5dfd5ee1cf0e915911b1c8f95ef4b09da8c4b`.
Scope: remove normal one-minute reply latency while retaining the durable queue, retry and scheduler recovery path.

## Result

The authenticated webhook now stores each Telegram update durably, then attempts to process that exact update and deliver its resulting outbox actions within the same request. If immediate processing or delivery throws, the webhook still returns HTTP 200 after persistence and leaves the item for the existing scheduled worker. The worker schedule, retry limits, leases, dead-letter behavior, per-chat pacing and Telegram `retry_after` handling are unchanged.

The implementation adds exact-row claims for both stages:

- `claim_telegram_update_by_id` claims only the requested inbound update;
- `claim_telegram_outbox_by_update_id` claims only deliverable actions for the requested parent update.

These claims prevent the webhook and scheduled worker from processing the same leased work concurrently.

## Cloud migration and verification

The source migration is `0009_telegram_immediate_claims`. Lovable's managed path applied its semantically identical duplicate as `0010_telegram_immediate_claims`; both records are preserved as immutable applied history.

Both functions are owned by `postgres`, use `SECURITY DEFINER`, fix `search_path` to `public, pg_temp`, and are executable only by `postgres` and `service_role`. `PUBLIC`, `anon` and `authenticated` cannot execute them.

Lovable exercised the claims inside a rolled-back transaction. The requested update and its outbox action were the only rows claimed; second claims and general worker claims returned no rows while leases were held; a processed update and an outbox action whose parent was unprocessed were not claimable; and the exercise left no residue. All six cron jobs remained active with their existing schedules and scheduler-secret header. An empty worker probe returned HTTP 200 with all counters at zero. The subsequent Lovable security scan reported no issues.

## Production smoke

The owner authorized publishing exact commit `67f5dfd5ee1cf0e915911b1c8f95ef4b09da8c4b` to `bruh.tips`. Lovable reported that the website was updated. The homepage returned HTTP 200 and an unauthenticated webhook POST returned HTTP 401.

A harmless private-chat `/help` request then completed through the production webhook and Bot API:

| Event | UTC timestamp |
| --- | --- |
| Webhook POST | `2026-09-12 16:57:51.474Z` |
| Durable receive | `2026-09-12 16:57:52.836Z` |
| Processing complete | `2026-09-12 16:57:53.636Z` |
| Reply sent | `2026-09-12 16:57:54.182Z` |

The webhook returned HTTP 200. The inbound update and outbox action each completed on their first attempt with no recorded error. Receive-to-process was 0.80 seconds, process-to-send was 0.55 seconds, and request-to-send was about 2.71 seconds. The scheduled fallback was not used. The owner confirmed that the resulting `/help` reply looked good.

## Remaining limits

Telegram's Bot API has no general idempotency key. A process crash after Telegram accepts a reply but before BRUH records `sent_at` can still cause a duplicate reply on retry. Multi-write command handlers also still need source-update idempotency so a partial database failure cannot repeat an already-committed internal effect.

This rollout verifies ordinary command response latency and durable recovery. It does not verify wallet linking, Solana devnet transfers, provider behavior or mainnet readiness.
