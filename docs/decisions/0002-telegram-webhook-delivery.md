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

## Reason

Telegram retries non-successful webhook deliveries, but the previous synchronous handler returned success even after processing errors and therefore lost work. Durable receipt separates Telegram's delivery window from slower bot logic and gives operators inspectable retry state.

## Operational requirement

Do not publish the queue-based webhook until the migration is applied and a scheduler caller is configured. Without the worker, authenticated updates will be stored but not processed. Database claims prevent concurrent application of one queue row; external Telegram messages can still be repeated if a worker crashes after sending but before recording completion, so durable handlers must keep their database effects idempotent.

## Implementation

Implemented on `codex/durable-webhook` in `20260912053000_durable_telegram_updates.sql`, `src/lib/telegram-updates.server.ts`, and the public webhook/worker routes. Record the pull request and merge commit here after integration.
