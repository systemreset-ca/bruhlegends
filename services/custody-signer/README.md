# BRUH devnet SOL signer

Owner-authorized funded wallets, issue #45 / decision 0006. Uses the same Solana SDK keypair/transfer/sign/broadcast pattern observed directly in the reference application's [wallet generator](https://github.com/systemreset-ca/blackboxfarm/blob/main/supabase/functions/blackbox-wallet-generator/index.ts) and [withdrawal function](https://github.com/systemreset-ca/blackboxfarm/blob/main/supabase/functions/blackbox-wallet-withdrawal/index.ts). Reference source was read, not changed; no private configuration or wallet inventory was copied. The GitHub reference and current Lovable snapshot differ, so neither is treated as proof of the other's deployed state.

Install this package separately with `pnpm --dir services/custody-signer install --frozen-lockfile --ignore-scripts`. Application dependencies and Bun lock remain unchanged. SDK version is pinned to 1.98.4, rather than copying the reference's older pin. Official SDK documentation: https://solana-foundation.github.io/solana-web3.js/ (1.x maintenance API).

`DevnetCustodyVault.provision` generates an encrypted wallet. `signSolTransfer` authenticates wallet/group/member binding and signs only an SDK-constructed SOL transfer, never caller-supplied arbitrary transaction bytes. The result contains the transaction signature and wire bytes, not private keys. Reference accounts are read-only and non-signing. Amounts are integer lamport strings.

`DevnetSolRpc.prepare` checks actual RPC genesis, obtains a finalized blockhash, builds the exact message and checks its network fee against the reservation cap. The authorized signer then signs the persisted approval snapshot. Commit signed bytes using the durable-first submission protocol before calling `broadcast`. The RPC adapter broadcasts identical bytes with preflight enabled. `inspect` requests finalized chain data, compares the complete serialized message and signature and returns actual fee/slot. Missing chain data stays pending; it never authorizes releasing funds or signing a replacement.

## Required integration sequence

1. Authenticate Telegram identity and obtain the exact group/member-owned wallet and immutable tip reservation using controlled database operations. Never accept an authorization snapshot directly from an unauthenticated client.
2. Prepare and durably store one blockhash/approval snapshot per reservation before signing. Concurrent workers must reuse that snapshot; an expiring lease must not create a second signed transaction.
3. Sign through the isolated vault. Durably store the immutable signed transaction before broadcast. Reuse its signature/bytes after timeouts.
4. Verify finalized exact proof and settle atomically with the actual fee and immutable audit receipt. Definitive failures still incur fees and need separate reconciled release handling.

No HTTP endpoint or bot integration is active. The SQL outbox/authorization adapters, authenticated deposit discovery, dedicated backend deployment and withdrawal/export step-up remain required. No production wrapping key or real user wallet was created. Cryptography and SDK signatures are tested using ephemeral wallets; RPC responses are mocked in tests. Concurrent workers and independent review are NOT RUN. Do not enable mainnet or collect real funds from this slice.

## Live smoke experiment — 2026-09-13

Run from the repository root: `node --experimental-transform-types services/custody-signer/devnet-smoke.ts`. The script creates ephemeral encrypted test wallets, verifies public devnet genesis and requests 0.01 faucet SOL once. It persists test signed bytes before broadcasting a 0.001 SOL transfer and verifies finalized exact proof and recipient balance. The local artifact directory is ignored; no wrapping keys or seeds are written. These test wallets are discarded when the process exits.

The first live attempt rejected a truncated expected genesis identifier before requesting funds. A direct public `getGenesisHash` request provided the complete identifier, now fixed in the adapter. The subsequent faucet request returned an internal error; no transfer was submitted. Therefore live funding/submission/confirmation are NOT VERIFIED. Do not retry the faucet repeatedly or count mocked RPC tests as live evidence.
