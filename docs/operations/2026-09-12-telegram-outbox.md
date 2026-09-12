# Durable Telegram outbox Cloud rollout

Operation date: 2026-09-12 (America/Toronto).
Cloud project: Lovable project `e287f314-27c2-40bf-94f4-4685a95781fe` and its connected Supabase database.
Feature merge: PR #18, merge commit `d7921e016292f4050ccc1f332e75fd8c198c99af`.
Cloud reconciliation baseline: `main` at `e50b99837030618913b040baca76bac023bbaf9b`.
Scope: apply and verify the durable Telegram reply outbox, then widen the existing conditional Telegram worker schedule to cover both inbound updates and pending outbound actions.

## Result

The migration and scheduler update passed Cloud verification. Telegram API failures now retry the queued outbound action without rerunning the webhook command handler and its database effects. Actions become claimable only after their parent webhook update is marked processed.

The existing `bruh-process-telegram-updates` job remains the only Telegram worker job. Its job identifier, endpoint, scheduler secret header, timeout and `* * * * *` cadence are unchanged. Its condition now invokes the endpoint when either queue has eligible work:

- `webhook_updates` has ready, retryable or expired-lease work; or
- `telegram_outbox` has an unsent action below the ten-attempt limit that is ready, retryable or has an expired lease, and its parent update is processed.

The condition still makes no application HTTP request while both queues are idle. The database evaluates one lightweight predicate each minute; the operation did not add a second job or a second idle request.

## Migration history

The source migration is `0007_durable_telegram_outbox`. Lovable's owner-capable managed path created and applied `0008_durable_telegram_outbox` while applying the pending migration. The two SQL files differ only by one trailing blank line and are semantically identical.

Both entries are immutable applied history. Drizzle journal indexes 7 and 8 are retained. Lovable-generated commits `2f9c5ce`, `54a5b82` and `e50b998` on `main` contain the managed migration record, generated metadata/type reconciliation and scheduler operation history.

## Catalog verification

`public.telegram_outbox` has this verified posture:

| Property | Cloud result |
| --- | --- |
| Owner | `postgres` |
| RLS | enabled |
| Client policy | exactly one restrictive `FOR ALL` policy for `anon` and `authenticated`, with false `USING` and `WITH CHECK` |
| `PUBLIC` privileges | none |
| `anon` privileges | none |
| `authenticated` privileges | none |
| `service_role` privileges | full table privileges |

`public.enqueue_telegram_action(bigint, text, text, jsonb)` and `public.claim_telegram_outbox(integer, integer)` are owned by `postgres`, use `SECURITY DEFINER`, fix `search_path` to `public, pg_temp`, and can be executed only by `postgres` and `service_role`.

## Transactional behavior exercise

Lovable ran a synthetic exercise inside a transaction and rolled it back. It left zero residual rows and returned counts only:

- the first enqueue created one action;
- claiming before the parent update was processed returned zero actions;
- enqueueing the same update/action key again retained one row and updated the unsent payload;
- claiming after the parent was processed returned one action;
- an immediate second claim returned zero because the lease was held;
- enqueueing against an already-sent action retained one row and did not alter its payload.

An authenticated worker request with empty queues returned HTTP 200 and zero for every update and delivery counter.

## Security scan

The Lovable scan reported no finding for `telegram_outbox` or its functions. It reported two advisory warnings for the existing server-only `market_observations` and `supported_assets` tables. Those tables are deliberately deny-by-default: their effective client privileges were removed and their restrictive false policies were independently verified in the complete [Cloud privilege audit](2026-09-12-cloud-privilege-audit.md).

## Remaining delivery limit

Telegram's Bot API does not provide a general idempotency key for these methods. A process crash after Telegram accepts an action but before BRUH records `sent_at` can therefore still cause a duplicate message on retry. The outbox closes the larger failure mode in which a Telegram error reran command-side database work, but it cannot eliminate this narrow acknowledgement window.

A second resilience slice is still recommended for multi-write command handlers: record source-update effects idempotently so a database failure partway through a handler cannot repeat an already-committed internal effect on retry.

## Production publication

After the Cloud checks and operation record were reviewed and merged, the owner explicitly authorized publication of exact GitHub `main` commit `240570b00fe9af06001476ffc3e9547a9c517c12`. Lovable reported “Your website was updated.” A direct post-publish request to `https://bruh.tips/` loaded the BRUH Legends production page and its Telegram link successfully.

This verifies that the public deployment is reachable. The next live boundary is a harmless private-chat `/help` update through the real Telegram webhook, inbound queue, command handler, outbound queue and Bot API delivery. No wallet operation or transaction is needed for that smoke test.
