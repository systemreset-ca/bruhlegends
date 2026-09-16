# Protected devnet wallet export

Status: source and managed migration ready for review; gate remains disabled until Cloud validation.

## Purpose

`/wallet keys` now prepares a short-lived export request for the caller's single active BRUH
devnet wallet and sends a fresh private Telegram Mini App button. The Mini App verifies both the
one-time login session and Telegram `initData`, then requires the existing Secure Action Password.
Successful authorization permits one reveal of the conventional Solana 64-byte secret key
(seed plus public key). The screen clears the value after 60 seconds.

No key is placed in Telegram messages, URLs, database rows, audit payloads, logs, local storage or
repository documentation. Only the already-encrypted wallet envelope remains stored. Anyone who
copies an exported key controls that wallet; the UI states this before authorization.

## Security and storage

- `BRUH_ACCOUNT_WALLET_EXPORT_DEVNET_ENABLED` is a separate default-off gate. The account-wallet
  and devnet gates must also be active.
- Migration `0028_bruh_account_wallet_export.sql` adds forced-RLS request and authorization tables.
  Direct access is revoked from PUBLIC, `anon`, `authenticated` and `service_role`; controlled
  functions are executable only by `service_role`.
- Requests bind the Telegram account, active wallet id, public address and devnet network, expire
  after ten minutes and reuse one live request per account.
- Password challenges reuse the existing account-bound PBKDF2 credential, throttling, five-failure
  lockout and two-minute proof window. Grants contain only a hash, expire after 60 seconds and are
  consumed atomically before decryption.
- Audit events record request, attempt, authorization and reveal without key material. Audit rows
  remain immutable.
- Decrypted seed and 64-byte secret buffers are zeroed after base58 encoding. JavaScript strings
  cannot be reliably zeroed, so the returned string exists only in the verified response and React
  state until the 60-second clear or Mini App closure.

## Validation

- Wallet-vault tests verify the exported secret is 64 bytes, reproduces the stored public address,
  and rejects wrong account scope and encryption keys.
- Export service tests cover sanitized request/read behavior, correct password proof, opaque grant
  consumption, valid exported key output and wrong-password refusal before consume/decrypt.
- Bot tests verify `/wallet keys` produces a private Mini App link and `/wallet destroy` remains
  unavailable.
- Isolated PostgreSQL validation covers account binding, request reuse, wrong-account denial,
  challenge serialization, 100,000-iteration compatibility, replay refusal, forced RLS, explicit
  function grants and immutable audit history.

## Remaining rollout

Apply migration 0028 in the original BRUH Lovable project, verify effective Cloud privileges and
tests, then set `BRUH_ACCOUNT_WALLET_EXPORT_DEVNET_ENABLED=true` and publish. Complete one real
owner export/reimport check using devnet only. Retirement, withdrawals, external-address ownership,
mainnet, swaps and rewards remain outside this slice.
