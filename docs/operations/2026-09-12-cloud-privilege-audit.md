# Cloud privilege audit

Audit date: 2026-09-12 (America/Toronto).
Cloud project: Lovable project `e287f314-27c2-40bf-94f4-4685a95781fe` and its connected Supabase database.
Repository baseline: `main` at `123510e9239b7ff2e872a75c1f04f504e6ca9825`.
Scope: effective-access verification of all 21 tables flagged by the Lovable basic security scanner, followed by scoped privilege hardening. No row, secret, setting, scheduler job or deployment was changed.

## Initial result

No current browser or REST data exposure was confirmed. All ten sensitive tables have RLS enabled and no policies, so `anon` and `authenticated` cannot select, insert, update or delete rows. Both roles are non-owner roles without `BYPASSRLS`. `service_role` has `BYPASSRLS`, as expected for the server-only credential.

The audit did identify a medium-priority latent risk: every table has explicit, materialized grants for all table privileges to both `anon` and `authenticated`. This includes `TRUNCATE`, which RLS does not restrict. PostgREST does not expose a truncate operation and no callable function supplies that path, so the privilege is not currently reachable through the public API. The grants should still be removed because an accidental future policy or SQL execution path could make them effective.

## Warning mapping

| Lovable warning | Verified table or tables |
| --- | --- |
| Membership and identity data | `public.group_members` |
| Session and authentication tokens | `public.miniapp_sessions`, `public.miniapp_login_tokens` |
| Swap intent financial data | `public.swap_intents`, `public.verified_swaps` |
| Telegram user identity data | `public.telegram_users` |
| Tip transaction data | `public.tip_intents`, `public.verified_transfers` |
| Wallet verification challenge data | `public.wallet_challenges` |
| Wallet ownership records | `public.wallets` |

## Effective privilege matrix

All ten tables have the same effective posture:

| Property | Verified value |
| --- | --- |
| Owner | `postgres` |
| RLS | enabled; not forced |
| Policies | none |
| `PUBLIC` table grants | none |
| `anon` table grants | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| `authenticated` table grants | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| `service_role` table grants | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| Client role ownership or `BYPASSRLS` | none |
| `service_role` | `BYPASSRLS = true` |
| Exposing views/materialized views | none in `public` or `graphql_public` |
| Realtime publication | none of the ten tables is published |
| Related sequences | none in `public`; keys do not depend on sequences |

The table ACL on each object is:

```text
{postgres=arwdDxtm/postgres, anon=arwdDxtm/postgres, authenticated=arwdDxtm/postgres, service_role=arwdDxtm/postgres, sandbox_exec=ar/postgres}
```

These grants are table ACL entries, not merely prospective defaults. They were materialized when `postgres` created the tables.

## Default ACLs

The Cloud database has broad default table privileges in `public` for objects created by both `postgres` and `supabase_admin`. The ten audited tables were created and are owned by `postgres`; that role's default supplied their grants. The `supabase_admin` default is platform-managed and did not create these objects.

Do not alter the `supabase_admin` default. It governs platform-created objects and may be restored or relied on during managed upgrades. The `postgres` default could technically be closed with:

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
```

This audit does not recommend applying that statement yet. It would change the convention for every future public table and can cause operational mistakes when a deliberately client-readable table is added without an explicit grant. Continue to define and review grants per table, then revisit the `postgres` default as a separate database-wide decision.

## Application and managed-service impact

Source inspection found no browser-side `.from(...)` access to the audited tables. Current BRUH data access is in server modules and uses `SUPABASE_SERVICE_ROLE_KEY`. The browser Supabase client is used for authentication support, not direct access to these domain tables.

Revoking `anon` and `authenticated` table privileges from these ten tables should not affect:

- Supabase Auth, which uses the managed `auth` schema;
- Realtime, because none of these tables is in a publication;
- PostgREST schema discovery, which uses catalog access and retained schema `USAGE`;
- current BRUH server flows, which retain `service_role` access;
- `exchange_miniapp_login_token`, `complete_wallet_challenge` or `claim_telegram_updates`, which are fixed-search-path `SECURITY DEFINER` functions executable only by `postgres` and `service_role`.

`SET LOCAL ROLE anon` and `SET LOCAL ROLE authenticated` could not be used from the Lovable SQL sandbox because its execution role lacks membership in those roles. Public REST probes returned empty successful responses, but all ten tables were empty, so those probes were not conclusive. The effective-access conclusion rests on PostgreSQL catalog evidence: RLS is enabled, no policy grants row access, and neither client role owns the tables or bypasses RLS.

## First remediation result

Migration `20260912110000_harden_sensitive_table_privileges.sql` removes every client table privilege while preserving explicit server access:

```sql
REVOKE ALL ON
  public.group_members,
  public.miniapp_sessions,
  public.miniapp_login_tokens,
  public.swap_intents,
  public.verified_swaps,
  public.telegram_users,
  public.tip_intents,
  public.verified_transfers,
  public.wallet_challenges,
  public.wallets
FROM PUBLIC, anon, authenticated;

GRANT ALL ON
  public.group_members,
  public.miniapp_sessions,
  public.miniapp_login_tokens,
  public.swap_intents,
  public.verified_swaps,
  public.telegram_users,
  public.tip_intents,
  public.verified_transfers,
  public.wallet_challenges,
  public.wallets
TO service_role;
```

The migration also adds a restrictive `FOR ALL` policy with `USING (false)` and `WITH CHECK (false)` for `anon` and `authenticated` on each table. Each policy is dropped by its exact name before creation so the Lovable migration runner can safely execute its validation pass more than once. These policies create a second boundary: an accidental restored grant or permissive client policy does not provide row access until the restrictive deny policy is deliberately removed. A `service_role` policy was not added because that role bypasses RLS and such a policy would have no enforcement effect.

Lovable applied the migration through its owner-capable path on 2026-09-12. All ten tables now have no table privileges for `PUBLIC`, `anon` or `authenticated`; `service_role` retains all seven table privileges; RLS remains enabled; and each table has exactly one restrictive false client policy. Row counts remained unchanged. Public REST probes now return permission errors, while safe empty-work service-role probes remained successful. The original seven scanner warnings cleared.

The Lovable migration runner recorded a second Drizzle migration (`0004_harden_sensitive_table_privileges`) with the same DDL as the committed `0003` migration. Re-entrant DDL left only one policy per table. Both journal entries are preserved because they are applied migration history; removing or rewriting either entry would make repository history disagree with the connected database.

## Remaining-table audit

After the first ten warnings cleared, the scanner identified the same condition on 11 more tables:

- `announcement_queue`
- `audit_events`
- `calls`
- `disputes`
- `groups`
- `market_observations`
- `milestones`
- `seasons`
- `supported_assets`
- `bruh_price_quotes`
- `webhook_updates`

The read-only Cloud audit found an identical access shape on all 11: owner `postgres`, RLS enabled and not forced, zero policies, no Realtime publication membership, no related sequences or exposing public views, and explicit full table grants for `anon`, `authenticated` and `service_role`. `PUBLIC` has none. Ten tables were empty; `supported_assets` contained three rows, none readable through the public REST API because RLS denied all rows.

Source and Cloud function inspection classified all 11 tables as server-only today. `supported_assets` is read by `tips.server.ts` and `miniapp.server.ts`; `bruh_price_quotes` has no application read path. Other access is through server modules using `supabaseAdmin`, service-role scheduler routes, or the service-role-only `claim_telegram_updates` and `complete_wallet_challenge` functions. No current Supabase Auth, Realtime, browser, public token-price UI, Telegram processing or scheduler flow depends on client table grants.

Migration `20260912113000_harden_remaining_table_privileges.sql` applies the same re-entrant remediation to these 11 tables. If a public asset list or public price interface is added later, it must receive a deliberately reviewed narrow server endpoint or narrowly scoped policy and grant; the current restrictive policy must not be removed incidentally.

## Remaining-table remediation result

Lovable applied the pending `0005` migration and an owner-path-generated, semantically identical `0006` migration on 2026-09-12. Both journal entries and files remain in source as applied history. The re-entrant statements produced exactly one policy per table.

Post-application verification passed for all 11 tables:

- owner remains `postgres`; RLS remains enabled and FORCE RLS remains off;
- exact ACL is `{postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres, sandbox_exec=ar/postgres}`;
- `PUBLIC`, `anon` and `authenticated` have zero of 77 checked table privileges; `service_role` has all 77;
- every table has exactly one restrictive `ALL` policy for `{anon,authenticated}` with false `USING` and `WITH CHECK` predicates;
- row counts are unchanged: `supported_assets` remains at three and the other ten remain empty;
- public REST probes return HTTP 401 / PostgreSQL `42501 permission denied` without data;
- authenticated non-mutating probes for call refresh, tip verification, Telegram update processing, hourly maintenance and retention pruning return HTTP 200 with zero-work results;
- relevant SECURITY DEFINER functions, triggers and all six scheduler jobs remain unchanged and recent scheduler runs succeeded;
- the Lovable basic security scan reports no issues.

No application code, default ACL, secret, scheduler configuration, domain setting or deployment was changed. The site was not published for this database-only operation.
