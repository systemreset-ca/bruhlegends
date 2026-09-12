# Solana provider and network configuration

BRUH reads Solana state through a server-only JSON-RPC endpoint. It never sends a private key or seed phrase to the provider and never signs a user transaction server-side.

## Devnet validation

Store these names in Lovable's server secret/configuration manager:

| Name | Devnet value | Treatment |
| --- | --- | --- |
| `SOLANA_NETWORK` | `devnet` | Non-secret release configuration |
| `SOLANA_RPC_URL` | A dedicated Helius **Devnet HTTPS RPC URL** | Secret because the URL contains the API key |
| `SOLANA_MAINNET_ENABLED` | Leave unset | Mainnet release gate |
| `BRUH_TOKEN_MINT` | Leave unset | Keeps BRUH-token tipping disabled |

Helius is the recommended provider for the first devnet exercise because the owner already has an account, it supports the standard methods BRUH uses, and a dedicated key can be rotated without touching application code. Create a separate key for BRUH rather than reusing a key from another project. Do not paste its value into GitHub, Lovable chat, Codex chat, logs or documentation; place the complete HTTPS endpoint directly in Lovable's secret manager under `SOLANA_RPC_URL`.

The initial provider check is read-only: verify network health/version, fetch a known devnet balance, and confirm that the RPC returns transaction/reference queries expected by `solana.server.ts`. A later controlled tip uses a user-controlled devnet wallet and devnet funds. BRUH creates an unsigned Solana Pay request; the wallet signs, and BRUH credits the tip only after server-side confirmation matches the stored recipient, mint, amount and unique reference.

Devnet SOL is available without a `supported_assets` row. Devnet USDC remains unavailable until an enabled, network-scoped registry row names the chosen devnet mint. Mainnet USDC accepts only the canonical mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. BRUH accepts only an enabled registry row whose mint exactly matches `BRUH_TOKEN_MINT`.

## Mainnet release gate

Mainnet starts only when all three settings are explicit:

| Name | Required value |
| --- | --- |
| `SOLANA_NETWORK` | `mainnet-beta` |
| `SOLANA_MAINNET_ENABLED` | `true` |
| `SOLANA_RPC_URL` | Reviewed dedicated mainnet provider endpoint |

An unset or empty network selects devnet. An unknown network fails closed. Selecting mainnet without the exact release flag or without an explicit RPC endpoint also fails closed. Keep the mainnet flag absent until the devnet transfer matrix and security review are complete.

## Provider-key controls

- Use separate keys for devnet and mainnet.
- Restrict the key to the deployment where the provider supports restrictions.
- Set provider usage alerts and a conservative quota during testing.
- Rotate a key immediately if it appears in chat, source, browser history, logs or screenshots.
- Monitor error rate, throttling and RPC latency; BRUH already treats provider errors as failed verification and does not credit the tip.
