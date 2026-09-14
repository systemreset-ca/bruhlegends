# Account-tip authorization and constrained execution

Status: source integration; NOT deployed or an attestation of live Telegram spending.

## Behavior

Gated group `/tip <amount> SOL` reserves an exact referenced transfer between stored BRUH account wallets. A sender-bound callback delivers a private Telegram `web_app` button; the group never receives a login token. `/security` opens first-time password setup privately. `/wallet-action` is a functional authorization screen, not a landing-page marketing change.

Every sensitive server request resolves a stored session and independently verifies fresh Telegram Mini App initData (300 seconds), matching the same user. A separate Secure Action Password authorizes the exact intent. Passwords are submitted directly to the server and never via bot chat. Telegram two-step verification is not claimed to be verifiable.

Credential enrollment cannot overwrite an existing password. A setup lease precedes password hashing; account-level attempt leases count failures even if processing stops. Five failures lock attempts for 15 minutes. Successful verification creates a 60-second one-use grant bound to account and intent; only its SHA-256 digest is stored, and the grant is never returned by public server functions.

Passwords use account-scoped random salts and Node PBKDF2-HMAC-SHA256 at 600,000 iterations. [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) recommends Argon2id first and documents this PBKDF2 work factor for environments requiring that algorithm. Using Node's built-in implementation does not establish FIPS compliance, Trojan security parity or an independent custody audit.

The constrained signer authenticates the encrypted envelope and derived public key, and signs only the rebuilt native SOL transfer matching stored sender, recipient, amount and unique reference. It exposes no arbitrary-message signer or raw seed export. Live fee/balance and unsigned simulation precede decryption; signed simulation precedes atomic grant consumption and persistence. SQL rechecks group/membership eligibility and both frozen active wallets. Broadcast happens only after immutable signed bytes are stored. RPC sends use preflight and zero automatic retries. An uncertain submission retains the same signed transaction and reservation. Recovery validates its signature and entire message, verifies receipts first and never creates a replacement payment.

## Deployment dependencies and limits

Apply `docs/proposed-account-tip-schema.sql` after the existing account-wallet schema, then `docs/proposed-account-tip-authorization.sql`. Both are still proposed source files. Every new table has forced RLS and no direct service-role/public/anonymous/authenticated grants; controlled functions have explicit service-role execution. The authorization migration revokes direct service-role access to the older unrestricted signed-transition function.

The original BRUH Cloud project is the only deployment target. Existing wrapping and Helius secrets remain unchanged. `BRUH_ACCOUNT_TIPS_DEVNET_ENABLED` and `BRUH_ACCOUNT_SIGNING_DEVNET_ENABLED` default false; activate only after managed-schema checks and pilot readiness. All transport and execution remains devnet-only.

This is shared-worker encrypted custody, not an isolated signer immune to compromised application code, platform administrators or BYPASSRLS roles. There is no reset/export/withdrawal/retirement flow yet. No mainnet, swap, CHAD payout or BRUH token activation. Finalized account-tip receipts still need integration into legacy tip/stat/community-credit projections. Expired/failed signed transactions intentionally remain reserved pending a separately reviewed resolution path. This change does not claim those missing features work.

## Validation

Production cryptographic signing is exercised against encrypted generated-wallet fixtures; execution tests use mocked database/provider calls. Real disposable PostgreSQL tests exercise enrollment, leases, lockout, account/intent ownership, atomic consumption rollback, paused-group checks, denied direct grants and audit retention. The earlier funded twelve-account proof remains separate evidence of actual finalized devnet transfers, not a test of this new Telegram password workflow.
