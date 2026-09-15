# Secure Action Password enrollment lease order

Date: 2026-09-15 (America/Toronto)

## Real-user trigger

The owner's private Mini App correctly resolved existing devnet wallet
`5LvzxEt47i5idPV33VPDiMjcCSER9g3TrgnypLUzKeZt` and reported that no Action Password existed. A valid
new-password submission then returned the generic service-error response.

## Bounded Cloud diagnosis

The matching setup attempt created one lease at 12:38:03.66 UTC. Its 30-second enrollment window
expired at 12:38:33.66 UTC, and its throttle ended at 12:39:03.66 UTC. No credential or enrollment
audit row was created. The setup function succeeded; the enrollment function returned false because
its nonce was expired. Function ownership, `SECURITY DEFINER`, fixed `search_path`, grants, RLS and
runtime gates were correct.

The service acquired the lease before running PBKDF2-SHA256 at 600,000 iterations. That derivation
exceeded the lease in the deployed Worker runtime, making the nonce stale before the credential write.
No password, derived hash, salt, encrypted key, token or private Telegram identifier was read during
diagnosis.

## Fix

Generate the random salt and derive the account-bound hash first. Acquire the one-use setup lease only
after derivation, call enrollment immediately, and zero the derived hash buffer in `finally`, including
lease rejection and database-error paths. The database rules and 30-second write lease remain intact.

No schema, migration, grant, secret, wallet-data, marketing or mainnet change is required.
