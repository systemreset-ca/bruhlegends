# Existing-wallet Mini App status fix

Date: 2026-09-14 (America/Toronto)

## Trigger

After publication of PR #78, the owner opened the new Mini App from a private `/start` response. The
bot's earlier private message already showed `Copy Address`, proving an internal wallet existed, but
the Mini App displayed `Wallet setup status unavailable`.

## Cause

Wallet resolution succeeded. The onboarding service then attempted a direct `SELECT` from
`bruh_secure_action_credentials`. The authorization migration deliberately revoked all table access
from `service_role`, so this direct read failed as designed.

## Change

- Migration 0022 adds `bruh_secure_action_password_set(bigint)`, a stable `SECURITY DEFINER` function
  that returns one boolean and exposes no credential material.
- Only `service_role` receives execute permission; `PUBLIC`, `anon` and `authenticated` remain denied.
- The onboarding service uses the RPC after server-side Telegram/session verification.
- Wallet provisioning remains idempotent, so an existing active account wallet is reused.

## Validation

- Wallet-onboarding tests: 4 passed.
- Isolated secure-action database test: 1 passed, including false/true status and role grants.
- TypeScript typecheck: passed.

## Rollout

Apply migration 0022 in the original BRUH Cloud project, merge the reviewed source and publish that
exact main commit through the original Lovable project. Then verify a fresh private `/start` Mini App
shows the existing address and correct password state. No wallet row or key material should be reset.
