# Atomic tip settlement

Status: implemented in a review branch; Cloud migration and database validation pending.
Date: 2026-09-12.
Owner: Codex engineering.
Requirements: original BRUH plan Phase 4, server-verified transfers, controlled sensitive writes, auditable records, and expired-intent rejection.

## Problem and behavior

The previous confirmation path inserted a verified receipt, changed the intent status, and inserted an audit event in separate requests. It ignored the receipt-insert error, so a failed or conflicting insert could still produce a confirmed status and response. A simultaneous expiry request could also overwrite a completed confirmation.

`settle_tip_intent` locks the intent and returns an existing confirmed receipt on retries. For an open intent it rechecks expiry using wall-clock time after the lock, checks the reference/network/recipient/mint/amount snapshot used by the verifier, and inserts the unique receipt, confirmed status, and audit event in one transaction. A receipt uniqueness conflict leaves the intent open. Audit or status failures roll back the receipt. Expiry uses the same lock and records its event exactly once. Pending status updates cannot downgrade confirmed or expired records.

The function is executable only by `service_role`. It does not perform chain verification or sign transactions. The existing server-side verifier must succeed before the application supplies a signature. No new client access or secret is introduced.

## Validation and rollout

Application tests cover checked database errors, missing receipts, malformed RPC success, receipt conflict, idempotent confirmed reads, and expiry without provider calls. These mocks do not establish PostgreSQL behavior.

Apply the additive migration before deploying application code; the old application does not call the new function. Keep the current production application running until these owner-capable Cloud tests pass in fully rolled-back transactions:

1. Confirm an open synthetic devnet intent: exactly one receipt, one confirmed status, and one confirmation audit. Retry with the same or a different supplied signature: return the stored signature without additional records.
2. Supply a signature already used by a different synthetic intent: pending `receipt_conflict`; no status or audit change.
3. Alter each supplied snapshot field independently, including null/non-null mint: pending `intent_snapshot_mismatch`; no receipt.
4. Expire an intent before settlement: one expiry event, no receipt; repeated expiry adds no event.
5. Force an audit insert failure in an isolated rolled-back test: the entire receipt/status change rolls back. Do not alter production audit policy or grants to exercise this.
6. Use two database sessions to race confirmation against confirmation and confirmation against expiry; lock ordering must yield one terminal outcome and no contradictory records. A request that waits past expiry must be rejected after it acquires the lock.
7. Verify effective function privileges: PUBLIC, anon, authenticated cannot execute; service_role can. Table RLS and grants remain unchanged.
8. Roll back all fixtures and report counts only; no wallet addresses, Telegram identifiers, signatures, credentials, or row payloads in chat.

No Cloud migration, concurrent database exercise, live transaction, preview deployment, or production publication is claimed by this decision record. The two-account devnet wallet test remains a separate launch requirement. Rollback application code first if needed; the unused additive function can remain until a later reviewed cleanup.
