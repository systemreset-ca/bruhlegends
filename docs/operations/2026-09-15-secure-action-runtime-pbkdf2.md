# Secure Action Password production PBKDF2 compatibility

Date: 2026-09-15 (America/Toronto)

## Production finding

The first enrollment after the native WebCrypto deployment reached the server
and authenticated successfully, but the production Worker rejected PBKDF2 at
600,000 iterations with an `OperationError`. That runtime supports at most
100,000 PBKDF2 iterations. No setup lease or enrollment write occurred.

At diagnosis time the project had zero Secure Action Password credentials and
zero enrollment audit events. There was therefore no stored verifier to migrate
or invalidate.

## Change

The PBKDF2-SHA256 work factor is 100,000 in application code and the database
constraint/enrollment function. Passwords still require at least 15 characters,
an uppercase letter and a special character. Each verifier retains a random
128-bit salt plus the Telegram account identifier. Enrollment and tip approval
remain rate-limited, action-bound, single-use and audited.

Migration `0026_bruh_secure_action_runtime_pbkdf2.sql` updates the credential
constraint and the controlled enrollment function. It preserves function
ownership, `SECURITY DEFINER`, `search_path=pg_catalog`, and service-role-only
execution.

## Acceptance

Publish only after unit tests, typecheck, targeted lint, production build and
isolated PostgreSQL validation pass. Then complete one fresh private `/security`
enrollment before attempting a two-account devnet tip.
