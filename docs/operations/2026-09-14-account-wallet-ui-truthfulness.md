# Operation record — account-wallet UI truthfulness and migration/ACL evidence

Date: 2026-09-14 (UTC)
Owner authorization: standing owner authorization for this bounded UI/documentation task.
Source: GitHub `main` synced at `16b602c` (merge of PR #50, `codex/account-wallet-rollout`), clean tree.

## Purpose

Make every user-facing claim about custody truthful now that a gated, switched-off
test-network account-wallet feature exists, and record the applied migration together
with verified ACL evidence for Codex review. No bot/server code was edited, no schema
or configuration was changed, and nothing was published.

## Specification

- `docs/decisions/0006-per-user-bruh-wallet.md` — one active BRUH-generated wallet per
  Telegram account, shared across that account's installed groups; group-scoped calls,
  statistics and tip attribution remain isolated.
- `docs/proposed-account-wallet-schema.sql` — applied as managed migration (below).

## Changed behavior (presentation only)

- `src/routes/index.tsx` — hero badges now read "Telegram · Solana · Non-custodial tipping"
  and "No seed phrases · Tips you sign yourself · No promises of profit"; the tipping
  feature card, the `/wallet` command line and two FAQ answers ("Does BRUH ever hold my
  funds?", "Can someone see my stats in another group?") now state the exception openly:
  a switched-off test-network beta can generate one encrypted BRUH wallet per Telegram
  account, shared across that account's groups, with spending, key export and retirement
  unavailable and no real value.
- `src/routes/privacy.tsx` — metadata and the group-isolation section no longer claim
  unqualified "no keys"; they distinguish the user's own wallet keys (never stored) from
  the generated, encrypted test-network wallet, and state that a generated wallet belongs
  to the Telegram account while statistics stay per group.
- `src/components/site-chrome.tsx` — footer tagline narrowed to "Non-custodial tipping".
- `src/routes/app.tsx` — the Mini App Wallet tab opens with a beta notice describing the
  account wallet as created and viewed through private one-to-one bot commands (never in a
  group), with spending, key export and retirement unavailable, and clarifies that the
  linking form below is for the member's own external wallet used to receive tips. It does
  not invite external-wallet linkage as the account-wallet path.

Terms of Use already carried the equivalent disclosure and was left unchanged.

## Migration evidence

Applied managed migration: `drizzle/migrations/0015_bruh_account_wallets_devnet.sql`
(semantics of `docs/proposed-account-wallet-schema.sql` preserved; only the outer
`begin`/`commit` omitted because the managed migrator wraps each migration in one
transaction). Journal history preserved; no migration re-applied in this task.

## ACL evidence (read-only verification, 2026-09-14)

Tables (`pg_class` / `pg_policies`):

| table | rowsecurity | force rowsecurity | policies | relacl |
| --- | --- | --- | --- | --- |
| `public.bruh_account_wallets` | true | true | 0 | `postgres=arwdDxtm/postgres`, `sandbox_exec=ar/postgres` |
| `public.bruh_account_wallet_audit` | true | true | 0 | `postgres=arwdDxtm/postgres`, `sandbox_exec=ar/postgres` |

No grant of any kind exists for `PUBLIC`, `anon`, `authenticated` or `service_role` on
either table. (`sandbox_exec` is the platform's read-only inspection role, not an
application role.)

Functions (`pg_proc.proacl`):

| function | EXECUTE |
| --- | --- |
| `public.bruh_account_wallet_read` | `postgres`, `service_role` only |
| `public.bruh_account_wallet_provision` | `postgres`, `service_role` only |
| `public.bruh_account_wallet_immutable` (trigger) | `postgres` only |

No wallet records were read or created; both tables remain empty.

## Configuration (names and booleans only)

- `BRUH_ACCOUNT_WALLET_WRAPPING_KEY` — untouched; the existing persistent value (32-character
  random alphanumeric, 32 bytes of key material) is retained. Codex is implementing exact
  support for that form with no padding, truncation, default or replacement.
- `BRUH_ACCOUNT_WALLET_KEY_VERSION` = `devnet-v1` — untouched.
- `BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED` = `false` — feature gate remains closed pending the
  follow-up PR being merged and reviewed.
- `SOLANA_NETWORK` = `devnet`; devnet provider key in use; mainnet key untouched.

## Validation

- Strict typecheck: pass.
- Test suite: 125/125 across 22 files.
- Managed preview build: pass (production build succeeded at this revision).

## Remaining limitations

- The account-wallet feature is not usable: the gate is false and the vault key-format
  support lands in the follow-up PR.
- Custody isolation is unresolved — the wrapping key and the bot runtime still share one
  secret scope in this project; nothing here changes that.
- Nothing was published; publication remains Codex's action under standing authorization.
