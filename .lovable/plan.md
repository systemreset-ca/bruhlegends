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
