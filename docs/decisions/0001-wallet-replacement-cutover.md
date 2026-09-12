# Wallet replacement cutover behavior

- Status: accepted
- Date: 2026-09-12
- Owner: Codex engineering
- Affected requirement: original BRUH plan, Phase 3 wallet replacement

## Question

Which wallet receives newly created tips during the required 30-minute delay after a member verifies a replacement wallet?

## Decision

The previously active wallet remains eligible until the replacement wallet's `active_from` time. At that cutoff, the previous wallet's `replaced_at` time is reached and the newly verified wallet becomes eligible. Tip intents created before the cutoff remain bound to the recipient address already captured on the intent.

## Reason

This preserves the security delay without creating a period in which a member has no usable payout wallet. The database completes challenge consumption, wallet rotation and its audit event in one transaction, so concurrent challenge submissions cannot create two current wallets.

## Alternatives considered

- Disable payouts for the full delay. This creates an avoidable availability gap.
- Activate the replacement immediately. This defeats the specified account-takeover protection.

## Implementation

Implemented on `codex/atomic-auth` in `20260912042000_atomic_auth_credentials.sql` and `src/lib/wallets.server.ts`. Record the pull request and merge commit here after integration.
