# Operation record — devnet account-wallet activation, UI truthfulness and evidence

Date: 2026-09-14 (UTC)
Owner authorization: explicit owner instruction to activate the devnet creation-only wallet beta.
Source: GitHub `main` at `591d728777ce60d8baf4ee06816aa7e67bc768c9` (merge of PR #51,
`codex/wallet-secret-format`), clean tree. Referenced CI run: 34802960694 (passed).

## Purpose

Validate the stored wrapping key against the merged vault implementation without persisting any
wallet or identity, confirm the test network, enable the devnet creation-only gate, and make every
user-facing claim match the now-active state. No bot or server logic was edited and nothing was
published.

## Key validation — one trusted in-memory check

Executed once in a server-side process with injected configuration, using the existing stored
wrapping key and key version. No database write, no Telegram identity persisted, and no key,
envelope, seed or address printed. Booleans only:

| check                                                    | result |
| -------------------------------------------------------- | ------ |
| `wrapping_key_present`                                   | true   |
| `wrapping_key_import_ok`                                 | true   |
| `key_non_extractable`                                    | true   |
| `generate_ok`                                            | true   |
| `address_valid`                                          | true   |
| `envelope_shape_ok` (12-byte IV, 48-byte ciphertext+tag) | true   |
| `network_devnet`                                         | true   |
| `verify_roundtrip_ok`                                    | true   |
| `tamper_rejected` (scope/AAD mismatch rejected)          | true   |

The stored key and `BRUH_ACCOUNT_WALLET_KEY_VERSION` were not changed, rotated or re-generated.

## Network verification

- `SOLANA_NETWORK` = `devnet` — confirmed true.
- One bounded `getGenesisHash` read against the existing devnet provider endpoint:
  `devnet_genesis_match=true` (Solana devnet genesis). Mainnet configuration untouched; the
  mainnet provider key was not read or used.

## Gate

- `BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED` = `true`, applied as an in-place update to the existing
  configuration entry through the secure secret form. No deletion and no indirect delete/recreate
  was performed; the earlier deletion attempt was rejected by approval review and was not retried.
  Verified after the update: `gate_value_is_true=true`.
- Spending, key export and retirement remain unavailable — no code path for them exists.

## UI changes (presentation only)

All "switched-off beta" wording replaced with the active devnet creation-only status:

- `src/routes/index.tsx` — page metadata, hero badge ("Telegram · Solana devnet beta · No real
  funds"), hero paragraph, hero sub-badge ("Devnet only · Creation and balance only · No promises
  of profit"), the wallet feature card, step 04, the command list (`/start`, `/wallet make`,
  `/wallet show`) and both custody/isolation FAQ answers.
- `src/components/site-chrome.tsx` — footer disclosure and tagline.
- `src/routes/terms.tsx`, `src/routes/privacy.tsx`, `src/routes/token.tsx` — metadata and custody
  sections state that the beta is active, that the generated wallet's key is held encrypted by BRUH
  and is therefore not non-custodial, that it is one wallet per Telegram account shared across that
  account's groups with per-group statistics, and that spending, key export and retirement are
  unavailable on a test network with no real value.
- `src/routes/app.tsx` — the Mini App Wallet tab now directs members to the private bot commands
  (`/start`, `/wallet make`, `/wallet show`) and states that nothing needs to be linked here for the
  account wallet; the Send-a-tip panel states that tipping is switched off during the beta.

Working external tipping is no longer advertised anywhere.

## ACL evidence (read-only, re-verified)

| table                              | rowsecurity | force rowsecurity | policies | relacl                                                   |
| ---------------------------------- | ----------- | ----------------- | -------- | -------------------------------------------------------- |
| `public.bruh_account_wallets`      | true        | true              | 0        | `postgres=arwdDxtm/postgres`, `sandbox_exec=ar/postgres` |
| `public.bruh_account_wallet_audit` | true        | true              | 0        | `postgres=arwdDxtm/postgres`, `sandbox_exec=ar/postgres` |

No grant of any kind for `PUBLIC`, `anon`, `authenticated` or `service_role` on either table.

Documentation correction: the previous record described `sandbox_exec` as a read-only inspection
role. That is inaccurate. Its actual effective privileges on both tables are `a` (INSERT) and `r`
(SELECT) — read **and** insert. Role attributes observed:

| role            | rolsuper | rolbypassrls | rolcanlogin | rolcreaterole |
| --------------- | -------- | ------------ | ----------- | ------------- |
| `sandbox_exec`  | false    | **true**     | true        | false         |
| `postgres`      | false    | true         | true        | true          |
| `service_role`  | false    | true         | false       | false         |
| `authenticated` | false    | false        | false       | false         |
| `anon`          | false    | false        | false       | false         |

Because `sandbox_exec` carries `BYPASSRLS`, forced row-level security does not constrain it; its
INSERT and SELECT on these tables are effective. It is a platform-managed role and no platform
grant was revoked or altered. This is recorded as a known residual exposure for Codex's review.

Functions: `bruh_account_wallet_read` and `bruh_account_wallet_provision` — EXECUTE for `postgres`
and `service_role` only; `bruh_account_wallet_immutable` (trigger) — `postgres` only.

Applied migration remains `drizzle/migrations/0015_bruh_account_wallets_devnet.sql`; no migration
was applied or re-applied in this task.

## Validation

- Strict typecheck: pass.
- Test suite: pass (full suite at this revision).
- Managed preview build: pass.

## Remaining limitations

- Custody isolation is unresolved: the wrapping key and the bot runtime share one secret scope in
  this project.
- `sandbox_exec` retains BYPASSRLS with SELECT and INSERT on both wallet tables.
- No withdrawal, export or retirement path exists, so a devnet wallet cannot be emptied or removed.
- Not published — publication remains Codex's action after review.
