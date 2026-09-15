# Secure Action Password proof window

Date: 2026-09-15 (America/Toronto)

## Trigger

The real-user enrollment diagnosis proved that PBKDF2-SHA256 at 600,000 iterations takes longer than
30 seconds in the deployed Worker. Enrollment was fixed by deriving before its setup lease. The tip
authorization path cannot do that because the action-bound begin call supplies the stored salt and
verifier needed for derivation. Its original 30-second attempt nonce would therefore expire during the
same password proof and prevent a valid authorized tip.

## Change

Managed migration `0024_bruh_secure_action_proof_window.sql` replaces only
`bruh_secure_action_begin(bigint,uuid)` and extends its action-bound attempt nonce from 30 seconds to
two minutes. The account, exact tip intent, active reservation, lockout, one-at-a-time attempt,
single-use grant and replay checks are unchanged. The resulting grant still expires after 60 seconds
and is consumed atomically before signed transaction persistence.

The function remains `SECURITY DEFINER` with `search_path=pg_catalog`; only `service_role` receives
EXECUTE. No password, hash, salt, key, token or transaction data is logged or added to audit payloads.
No wallet, website, secret, mainnet, reward or token behavior changes.

## Validation

The isolated PostgreSQL test applies the managed migration and asserts the proof window is over 100
seconds and no more than 121 seconds. Existing cases continue to cover wrong account, wrong intent,
parallel attempts, failed proofs, five-attempt lockout, stale/mismatched nonces, one-use grants,
group/wallet rechecks, consumed authorization replay, effective grants, forced RLS and immutable audit.

Cloud application, exact-source validation, publication and a real password-authorized devnet tip are
required before this behavior is considered deployed and accepted.
