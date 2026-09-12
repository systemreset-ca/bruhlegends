# Lovable Cloud scheduler configuration — 2026-09-12

- Source commit: `a6006b150ca54a164562d36799f761f7f9b36044`
- Surface: connected Lovable Cloud project `e287f314-27c2-40bf-94f4-4685a95781fe` and its Supabase database
- Operator: Lovable, directed by Codex under owner authorization
- Production deployment: not performed

## Credential handling

Lovable generated a new cryptographically random `BRUH_SCHEDULER_SECRET` of at least 32 bytes internally. It reported that the same value is present in the Lovable server secret store and Supabase Vault. The value was not displayed, logged or committed.

Each job reads the credential from Vault at run time and sends it in `X-BRUH-Scheduler-Secret` with `Content-Type: application/json`. The obsolete `apikey` authorization header was removed.

## Active jobs and observed results

| Job | Schedule | Observed HTTP status | Redacted-safe response |
| --- | --- | --- | --- |
| `bruh-refresh-calls` | `*/5 * * * *` | 200 | `{"ok":true,"refreshed":0,"quarantined":0,"milestones":0,"announced":0,"queued":0}` |
| `bruh-verify-tips` | `*/2 * * * *` | 200 | `{"ok":true,"checked":0,"confirmed":0,"expired":0,"announced":0,"queued":0,"digestsSent":0,"prunedObservations":0,"prunedWebhookUpdates":0}` |
| `bruh-process-telegram-updates` | `* * * * *` | 200 | `{"ok":true,"claimed":0,"processed":0,"failed":0,"deadLettered":0}` |

Lovable observed the scheduled executions against the current preview after configuration. No application files were changed and production was not published.

## Verification limits

The successful empty-queue responses verify scheduler authentication, routing and basic worker startup in the connected preview environment. They do not verify processing of a real Telegram update, market refresh, Solana devnet transfer, production-domain routing or the production database binding.
