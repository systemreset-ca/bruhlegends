# Devnet two-wallet transfer exercise

Operation date: 2026-09-14 (UTC).
Scope: prove a real, bounded devnet SOL transfer between two disposable, in-memory keypairs using this project's existing devnet configuration. No application source, schema, grants, secrets, schedulers, webhook or deployment changes. No live user wallets.

Script: `tools/devnet-transfer/devnet-transfer.mjs`. It is a CLI experiment only; `@solana/web3.js` was installed out-of-tree and is **not** an application dependency.

## Safety properties of the script

- Both keypairs are created with `Keypair.generate()` in process memory; secret keys are never printed, logged or written to disk.
- The RPC endpoint is derived internally from `BRUH_DEVNET_API_KEY` (Helius devnet) with `SOLANA_RPC_URL` as fallback; the endpoint is never printed. The mainnet key is never read.
- Devnet genesis is checked against `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` before any other action; a mismatch aborts.
- Exactly one airdrop request, bounded confirmation. Raw provider errors are never surfaced — only a cause category.
- Transfer is sent with preflight enabled and verified at `finalized` commitment against the exact sender, recipient and amount.

## Actual outcome — run 1 (transfer completed)

| Fact | Value |
| --- | --- |
| Genesis | `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` (devnet confirmed) |
| Wallet A (sender) | `8pJ6TKk6j11bG4emK5Fg3Ceiz1eBXkLouqRXftWbkFUp` |
| Wallet B (recipient) | `ErbxWvE7DmkcKh4GqC3JJgSHvsFLwR213WCAmNMgUM53` |
| Airdrop | confirmed, 1 SOL |
| Transfer | 0.001 SOL, A to B, preflight enabled |
| Signature | `31gACsga1KENqSRdDWP2kQdPYxZAAw1KN76mM9o8gnhDajEY36C2jbsYfZcLCJYQDh5DH4oTFF8Go6NBzZ5ywCVq` |
| Explorer | https://explorer.solana.com/tx/31gACsga1KENqSRdDWP2kQdPYxZAAw1KN76mM9o8gnhDajEY36C2jbsYfZcLCJYQDh5DH4oTFF8Go6NBzZ5ywCVq?cluster=devnet |

Finalized verification (separate read-only query, slot `498017960`): `meta.err = null`; sender present; recipient present; sender delta `-0.001005` SOL (0.001 transfer + 0.000005 fee); recipient delta exactly `+0.001` SOL. **Status: TRANSFER VERIFIED (finalized).**

Codex independently queried `getTransaction` at finalized commitment through the public Solana devnet endpoint after Lovable's report. It returned slot `498017960`, null transaction error and the System Program transfer instruction with the exact public sender/recipient above and `1000000` lamports. This independent read used no Helius credential; the original execution used the original project's devnet configuration. Public chain evidence corroborates the transfer rather than relying only on the chat report.

Subsequent source hardening disables SDK HTTP 429 retries, adds a 15-second per-request timeout, rejects redirects, restricts fallback configuration to Helius devnet and verifies the actual transfer instruction plus sender signature. Node syntax validation passes. These later source changes were not rerun with another airdrop; no additional faucet call is justified just to recheck an already finalized transaction. The initial faucet retry behavior is historical, not the current setting.

Honest limitation of run 1: the script's own in-run verification printed `UNVERIFIED` because `getParsedTransaction` at `finalized` returned null immediately after confirmation. The transfer itself had succeeded; the check was premature. The script was corrected to poll for the finalized record within a bound before judging, so it no longer reports a false negative.

## Actual outcome — run 2 (corrected script, faucet refused)

Genesis confirmed devnet. Fresh wallets generated. The airdrop request received repeated HTTP 429 from the faucet across the client's bounded retries; cause category `rate_limited`. Sender balance stayed 0 SOL. The script correctly reported `NOT TRANSFERRED — sender unfunded`, printed the fresh funding address `BzdPSMRrkvx5KgpAMiTPg2Q8Vsv9tnnaMJ18EbLzwNPZ`, and stayed alive awaiting external funding. No transfer was attempted and no success was claimed.

This is a faucet quota condition following run 1's successful airdrop, not a provider-auth or configuration fault. The corrected polling path therefore remains exercised only in the unfunded branch; re-run it after the faucet window resets to observe an end-to-end `TRANSFER VERIFIED` print from the script itself.

## What this does and does not establish

Establishes: the configured devnet endpoint is genuinely devnet, funds a fresh keypair, accepts a preflighted transfer and returns a finalized record whose sender, recipient and amount match exactly. Client-side signing with in-memory keys works against this configuration.

Does not establish: any custody design, key storage, key isolation, production schema behavior, or mainnet readiness. Nothing here was deployed.
