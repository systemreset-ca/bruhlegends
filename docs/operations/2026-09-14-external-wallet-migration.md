# External address candidate schema — applied Cloud migration and evidence

Original project only: `systemreset-ca/bruhlegends`, Lovable `e287f314-27c2-40bf-94f4-4685a95781fe`.

## Source

Exact GitHub main `73a12d3283127c919c238bdcad5ca2b289957764` (PR #56 merged), clean tree. No source behavior changes in this task.

## Applied migration

`docs/proposed-external-wallet-schema.sql` applied verbatim in semantics as managed Drizzle migration
`drizzle/migrations/0016_bruh_external_wallet_candidates.sql`. Only the outer `begin`/`commit` was omitted,
because the managed runner wraps each migration in a single transaction. Existing journals and prior
migrations (through `0015_bruh_account_wallets_devnet.sql`) are preserved. No data rows were inserted;
no fake or user records exist.

`src/integrations/supabase/types.ts` was regenerated from the new schema by the migration tool.

## Verified privileges (post-apply)

| Object | Evidence |
| --- | --- |
| `public.bruh_external_wallet_candidates` | RLS enabled = true, FORCE RLS = true, policies = 0 |
| `public.bruh_external_wallet_audit` | RLS enabled = true, FORCE RLS = true, policies = 0 |
| Table privileges on both tables | `anon`, `authenticated`, `service_role`, `PUBLIC`: no SELECT/INSERT/UPDATE/DELETE |
| `bruh_external_wallet_read(text)` | EXECUTE: service_role only (anon/authenticated/PUBLIC false) |
| `bruh_external_wallet_register(text,text,uuid)` | EXECUTE: service_role only (anon/authenticated/PUBLIC false) |
| `bruh_external_wallet_immutable()` | EXECUTE: none of anon/authenticated/service_role/PUBLIC |
| Row counts | `bruh_external_wallet_candidates` = 0 |

Honest limitation: the platform role `sandbox_exec` has `rolbypassrls = true`. BYPASSRLS defeats row-level
policies but not table ACLs; nonetheless this platform-level role remains outside the application's
security boundary, as previously documented. No platform grants were changed.

## Checks with actual enabled devnet configuration

- TypeScript (`tsgo --noEmit`): pass.
- Full test suite: **137 passed across 24 files**, including `tests/account-external-wallet.test.ts`.
- Production build (`bun run build`): pass.

## Build-status diagnosis

The "Build unsuccessful" state shown on pushed cards reflected the pre-migration Cloud state: the generated
Supabase types did not contain `bruh_external_wallet_read` / `bruh_external_wallet_register`, so code in
`src/lib/account-external-wallet.server.ts` referencing those RPCs failed strict typing. Applying this
migration and regenerating types resolves it; types, tests and the production build all pass at this commit.

## Scope boundaries

External address candidates remain **unverified**: registration proves no ownership and authorizes no
withdrawal. No signing, withdrawal, key export, retirement, mainnet, rewards or token activation was
enabled. No secrets, projects or accounts were created, deleted or rotated. Not published — Codex reviews
the diff and publishes.
