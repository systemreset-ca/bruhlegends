# Private Telegram account-wallet creation

Source slice for issue #45 and decision 0008. The original BRUH project owns the bot and this implementation. No additional project is required by this slice.

## Implemented, not yet deployed

- Private `/start` generates and persists a devnet wallet if none exists; otherwise reuses it. No prior group membership is required.
- `/wallet make` requires a confirmation button in the same private account chat; concurrent creation is serialized by a transaction-scoped account lock and an active-wallet unique index.
- `/wallet show` authenticates the stored wallet envelope, then displays the public address and finalized balance. A failed chain read is explicitly unavailable, never zero.
- Group wallet commands redirect to private chat. Account ownership is shared across groups; group statistics and attribution remain separate.
- `/wallet keys` and `/wallet destroy` explicitly report unavailable, with no signing, plaintext-key transmission or destructive action. Full export/retirement implementation remains open.
- Bot-account spending is explicitly disabled in this creation-only mode; the old external-wallet tip flow remains unchanged when this mode is off.

## Encryption and access

Generate a random 32-byte Solana seed and derive its Ed25519 public key using the existing noble dependency. Encrypt the seed with AES-256-GCM, a random 12-byte nonce and authenticated wallet UUID / Telegram user / devnet / address / key-version binding. Verify authenticated decryption and rederived address before any address is displayed. Plaintext seeds are not stored or returned to presentation code. Input buffer clearing is best effort, not a guarantee against process compromise.

Persistent server configuration names:

- `BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED`: off unless explicitly set to `true` after validation.
- `BRUH_ACCOUNT_WALLET_WRAPPING_KEY`: persistent secure-manager-generated 32-character ASCII alphanumeric key, or a random 32-byte key encoded as 64 lowercase hex characters. Both import exactly 32 bytes into AES-256-GCM; the alphanumeric format has about 190 bits of entropy if generated uniformly, not 256 bits. No padding, truncation or default fallback. Never generate on boot, overwrite or rotate without a recovery/old-version plan.
- `BRUH_ACCOUNT_WALLET_KEY_VERSION`: matching durable version, e.g. `devnet-v1`.
- `SOLANA_NETWORK`: must be exactly `devnet`.
- Existing `BRUH_DEVNET_API_KEY` / `SOLANA_RPC_URL`: Helius devnet only, used for two bounded reads per balance request. Mainnet key is not used.

The proposed SQL file is `docs/proposed-account-wallet-schema.sql`. It enables/forces RLS, revokes direct table/sequence access from public/anon/authenticated/service_role, exposes controlled service-only provisioning/read RPCs, and prevents updates/deletes of wallet/history rows. RPC authentication relies on trusted server-side verified Telegram webhook identity; these functions are not client identity verifiers.

Lovable reports managed migration `0015_bruh_account_wallets_devnet.sql` applied in the original Cloud project, effective role grants checked, and empty wallet/audit tables. The reviewed migration preserves the proposed table/function semantics. Its secure generator stored the persistent key without revealing it, but produces the 32-character alphanumeric format; the compatibility follow-up accepts this exact format without replacing the key. Version is `devnet-v1`; creation gate remains false pending exact-source preview review. No live Telegram wallet creation or publication is claimed by this update.

This devnet implementation uses the original worker's secret store. It does not establish isolation against compromise of that worker or its administrators. It is not a mainnet custody certification, nor does public GitHub visibility prove key security. Mainnet/spending/export gates remain closed.

## Validation and rollout

Fourteen targeted tests passed across encryption, command ownership/confirmation, balance-network restrictions and legacy link regression. TypeScript passed. Isolated PGlite SQL execution passed provisioning reuse, wrong-user missing-wallet read, role-denied access, rejected mainnet/invalid identities, and immutable history checks. This is real SQL execution in one local embedded PostgreSQL instance, not proof of concurrent independent Cloud sessions. Changed-file lint is required after the final source edit; public CI adds the SQL check.

Next: exact-source CI/build, controlled Cloud schema application and effective-grant checks; persistent key generated once inside the original project's secure manager; preview creation/reload/address validation and disabled export/destruction/spending; publication; owner's two private Telegram accounts `/start` / `/wallet show` checks. No fabricated user test or live transfer is substituted for that journey.
