# Cloud privilege audit

Audit date: 2026-09-12 (America/Toronto).
Cloud project: Lovable project `e287f314-27c2-40bf-94f4-4685a95781fe` and its connected Supabase database.
Repository baseline: `main` at `378885cf5ff15a603bf613acdedb662fb8be452e`.
Scope: read-only verification of the seven Lovable basic security warnings. No database object, grant, policy, role, row, secret, setting, job, application file or deployment was changed during the Cloud audit.

## Result

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

## Implemented remediation

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

The migration also adds a restrictive `FOR ALL` policy with `USING (false)` and `WITH CHECK (false)` for `anon` and `authenticated` on each table. These policies create a second boundary: an accidental restored grant or permissive client policy does not provide row access until the restrictive deny policy is deliberately removed. A `service_role` policy was not added because that role bypasses RLS and such a policy would have no enforcement effect.

After applying the migration, verify `relacl`, `has_table_privilege` for all seven table privileges, policy inventory, public REST behavior, service-role server routes and the Lovable scanner. The desired result is no table privilege for `anon` or `authenticated`, unchanged full access for `service_role`, and no change to rows or application behavior.
