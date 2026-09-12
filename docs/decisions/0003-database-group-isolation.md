# Database-enforced group relationships

- Status: accepted
- Date: 2026-09-12
- Owner: Codex engineering
- Affected requirement: original BRUH plan group-isolation invariant

## Question

Should group membership checks remain only in server code, or should PostgreSQL reject cross-group relationships regardless of the caller?

## Decision

PostgreSQL enforces composite relationships for every table that stores a group id beside a membership, season, or call id. Calls require their caller and season to belong to the call's group. Tip intents require their sender, recipient and optional call to belong to the intent's group. Disputes require their optional call, raiser and resolver to belong to the dispute's group.

Application checks remain in place to return useful errors before attempting a write.

## Reason

The BRUH isolation rule is a data invariant. Enforcing it only in current request handlers would leave imports, future server functions, maintenance code and direct service-role writes able to create cross-group records accidentally.

## Migration behavior

The migration validates all existing rows. If legacy cross-group data exists, deployment stops for explicit investigation rather than accepting or deleting it. No historical row is silently changed.

## Implementation

Implemented on `codex/group-constraints` in `20260912064500_enforce_group_relationships.sql`; reviewed in pull request #6. Record the merge commit here after integration.
