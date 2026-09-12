# Telegram webhook delivery model

- Status: accepted
- Date: 2026-09-12
- Owner: Codex engineering
- Affected requirement: original BRUH plan, Phase 1 webhook durability

## Question

How should the public webhook acknowledge Telegram quickly without losing updates when business logic or a downstream provider fails?

## Decision

The public webhook verifies Telegram's secret header, validates the update id, and persists the raw payload under that id before returning success. It returns a retryable `503` when durable receipt fails. Processing occurs through `POST /api/public/hooks/process-telegram-updates`, authenticated with `BRUH_SCHEDULER_SECRET`.

Workers claim updates in update-id order with row locks and a five-minute lease. Each claim receives a unique token, preventing an expired worker from finalizing a newer attempt. Failures use exponential backoff capped at five minutes and move to `dead_letter` after ten attempts.

Outbound `sendMessage`, `answerCallbackQuery` and `editMessageText` actions emitted while handling a durable update are written to `telegram_outbox` under a deterministic update/action key. The worker marks the parent update processed before it claims those actions. Telegram delivery failures and rate limits therefore retry the outbox action without rerunning the command's database work. Calls made outside webhook handling, such as scheduled announcements, continue to use the direct Telegram client.

## Reason

Telegram retries non-successful webhook deliveries, but the previous synchronous handler returned success even after processing errors and therefore lost work. Durable receipt separates Telegram's delivery window from slower bot logic and gives operators inspectable retry state. The outbox also prevents an ordinary Telegram API failure from causing a second execution of an already-applied command.

## Operational requirement

Do not publish the queue-based webhook until the migration is applied and a scheduler caller is configured. Without the worker, authenticated updates will be stored but not processed. Database claims prevent concurrent application of one queue row. Telegram's Bot API does not accept a general caller-supplied idempotency key, so a process or database failure after Telegram accepts an action but before `sent_at` is recorded can still cause a repeated outbound action. The outbox narrows that ambiguity to this final acknowledgement window and keeps it separate from command execution.

## Implementation

Initial durable receipt was implemented in `20260912053000_durable_telegram_updates.sql`, `src/lib/telegram-updates.server.ts`, and the public webhook/worker routes; merged by pull request #5 as commit `aaf38f02554d61e22f48a51efcb1355847e7511e`. The durable outbound outbox is implemented by `20260912123000_durable_telegram_outbox.sql` and the same worker route.
