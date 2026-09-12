# Lovable Cloud migration application — 2026-09-12

- Source commit: `f00c60fb86c0b3b74ce278768756a64f2a3edaad`
- Surface: connected Lovable Cloud database for project `e287f314-27c2-40bf-94f4-4685a95781fe`
- Operator: Lovable, directed by Codex under owner authorization
- Production deployment: not performed

## Preflight evidence

Lovable reported PostgreSQL 17.6. The affected application tables were empty: `calls`, `tip_intents`, `disputes`, `group_members` and `seasons` each had zero rows. Read-only checks found zero violations for all eight composite group relationships in the final migration.

The migration ledger initially contained only the five original versions through `20260809145342`. PostgreSQL function lookup returned no rows for `exchange_miniapp_login_token`, `complete_wallet_challenge` or `claim_telegram_updates`.

## Applied in order

1. `20260912042000_atomic_auth_credentials.sql`
2. `20260912053000_durable_telegram_updates.sql`
3. `20260912064500_enforce_group_relationships.sql`

Lovable reported all three applied successfully. Its follow-up type check passed and its test run passed 62 tests across ten files. The preview bundle was already serving the merged commits; the red preview badge had represented the database-aware type-check gate.

## Remaining operational blocker

Lovable found two active database `pg_cron` jobs:

- `bruh-refresh-calls` every five minutes
- `bruh-verify-tips` every two minutes

Both call the Lovable development URL with an API-key header and return 401 because the endpoints now require `X-BRUH-Scheduler-Secret`. There is no job for `process-telegram-updates`. Configure one dedicated secret in the server environment and scheduler vault, update the two existing jobs, add the Telegram worker job, and verify authenticated responses before publishing these backend commits.

## Verification limits

This record captures Lovable's database and preview report. It does not establish that `bruh.tips` uses the same database binding, that effective grants/RLS have been independently tested, or that any production scheduler call or Solana devnet transfer succeeded.
