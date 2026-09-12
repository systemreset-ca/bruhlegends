# Build / preview status diagnosis (PR #1 → PR #6)

## Short answer

The app itself compiles and bundles fine. What is red is the type-check gate, and the cause is that the three database migrations added by the GitHub PRs were never applied to the Lovable Cloud database, so the generated database type file does not know about the new database functions.

## Evidence collected (read-only)

1. Bundle build at current `main` working tree: `bun run build:dev` (`vite build --mode development`) — SUCCESS, client + server output generated, no errors.
2. Test suite: `bun run test` — 62 tests in 10 files, all pass.
3. Type check: `bun run typecheck` (`tsc --noEmit`) — FAILS with exactly one error:

```text
src/lib/session.server.ts(41,10): error TS2345:
Argument of type '"exchange_miniapp_login_token"' is not assignable to parameter of type 'never'.
```

This is the classic signature of `supabase.rpc("<name>")` where `<name>` is absent from `src/integrations/supabase/types.ts` (the union is empty → `never`).

4. Database reality check against Lovable Cloud:

```sql
select version from supabase_migrations.schema_migrations order by version;
```

Returns only the five original Lovable migrations:
`20260809033130`, `20260809035344`, `20260809041315`, `20260809044010`, `20260809145342`.

The three PR-added migrations are **not** applied:
- `20260912042000_atomic_auth_credentials.sql` — not applied
- `20260912053000_durable_telegram_updates.sql` — not applied
- `20260912064500_enforce_group_relationships.sql` — **not applied**

A `pg_proc` lookup for `exchange_miniapp_login_token`, `complete_wallet_challenge` and `claim_telegram_updates` in schema `public` returns zero rows, confirming the functions do not exist in the live database.

5. Preview serving: requests for `id-preview-46c3484d…`, `id-preview-aaf38f02…` and `id-preview-f00c60fb…` all returned HTTP 200, i.e. the preview worker did build and serve those commits. The "Preview out of date" badge reflects the failed check gate, not an unserviceable bundle.

6. Dependency install is not the problem: only `bun.lock` is tracked (no pnpm lockfile in the repo), and `bun install --frozen-lockfile --dry-run` resolves cleanly. Local `pnpm build` succeeding is consistent — it never runs the type check or touches the database.

## Why every commit from PR #1 onward is flagged

Migration files pushed through GitHub are plain files in `supabase/migrations/`; Lovable does not auto-apply SQL that arrives via Git. Since PR #4 introduced `exchange_miniapp_login_token` in code and SQL at the same time, every commit after it type-checks against a database schema that never changed, so each synced commit fails the same gate. Docs-only commits inherit the red state because the gate runs on the resulting tree, not the diff.

## Remediation options (no action taken — approval required)

1. Apply the three pending migrations to Lovable Cloud in version order, then regenerate `src/integrations/supabase/types.ts` so `exchange_miniapp_login_token` and the other new functions are typed. Note `20260912064500` validates existing rows and will abort if legacy cross-group rows exist.
2. Or, if applying now is not wanted, temporarily type the RPC call site so the gate is green while the database stays as-is — this leaves the runtime call failing until the migrations land, so it is not recommended.

Unrelated observation, for the record: the scheduler hooks `/api/public/hooks/verify-tips` and `/api/public/hooks/refresh-calls` are being called every 1–2 minutes on the preview deployment and returning 401 continuously, because `BRUH_SCHEDULER_SECRET` is not configured on the caller side.

## Read-only preflight (requested before any migration)

**1. PostgreSQL version** — `PostgreSQL 17.6 on x86_64-pc-linux-gnu`. Relevant because `ON DELETE SET NULL (column)` used throughout `20260912064500` requires PostgreSQL 15 or newer; 17.6 supports it.

**2. Rows that would violate each composite relationship** — zero in every case, because the affected tables are empty:

| Constraint | Violating rows | Record IDs |
| --- | --- | --- |
| calls → caller membership in same group | 0 | none |
| calls → season in same group | 0 | none |
| tip_intents → sender membership in same group | 0 | none |
| tip_intents → recipient membership in same group | 0 | none |
| tip_intents → call in same group | 0 | none |
| disputes → call in same group | 0 | none |
| disputes → raiser membership in same group | 0 | none |
| disputes → resolver membership in same group | 0 | none |

Table totals: `calls` 0, `tip_intents` 0, `disputes` 0, `group_members` 0, `seasons` 0. No duplicate `(id, group_id)` pairs are possible, so the three new UNIQUE constraints are also safe. The `VALIDATE CONSTRAINT` block at the end of the migration will therefore pass.

**3. Transactional ordering** — yes. All three files contain only DDL that PostgreSQL allows inside a transaction block: no `CREATE INDEX CONCURRENTLY`, no `VACUUM`, no `ALTER SYSTEM`, no `CREATE DATABASE`, and no explicit `BEGIN`/`COMMIT` of their own. Order matters and is already correct by filename: `20260912042000` (auth credential functions) → `20260912053000` (adds `webhook_updates` columns/indexes plus `claim_telegram_updates`) → `20260912064500` (composite keys and foreign keys). The last one depends on the current shape of `calls`, `tip_intents` and `disputes`, none of which the earlier two alter, so there is no cross-file conflict.

**4. Where the preview scheduler calls come from** — `pg_cron` jobs inside the Lovable Cloud database itself, not an external service:

- job 1 `bruh-refresh-calls`, schedule `*/5 * * * *`, active
- job 2 `bruh-verify-tips`, schedule `*/2 * * * *`, active

Both use `net.http_post` against `https://project--…-dev.lovable.app/api/public/hooks/…` and send only `Content-Type` and an `apikey` header. They do not send `X-BRUH-Scheduler-Secret`, which is exactly why every invocation returns 401 after PR #2 replaced key-based authorization. There is no cron job for `process-telegram-updates` at all. Fixing this means updating the two job definitions to send the scheduler secret header and adding a third job for the Telegram update worker — separate from the migration work above.

