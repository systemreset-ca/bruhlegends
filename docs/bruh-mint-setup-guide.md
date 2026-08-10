# $BRUH Mint + Raydium CPMM — Step-by-Step Setup Guide

> Operational runbook for review. Nothing here is executed by the app. It assumes
> the locked decisions: original SPL Token Program, 6 decimals, fixed supply,
> mint + freeze authority revoked, one canonical BRUH/SOL Raydium CPMM at 0.25%,
> and the 1% service fee handled **app-level only** (already built) — never as a
> token transfer tax.

---

## 0. Before you touch mainnet

| Item | Why it matters |
|---|---|
| Full devnet rehearsal | Every step below, start to finish, on devnet first. Mistakes on mainnet are permanent. |
| Squads multisig created | Treasury, metadata authority and the Fee Key NFT all live here. |
| Hardware wallets | 3-of-4 signers, separate devices, separate physical locations. |
| Tokenomics finalised | Supply, allocations, vesting, initial price and liquidity budget must be decided **before** minting — supply is fixed forever. |
| Legal review | Issuance, public trading and marketing are jurisdiction-specific. Technical structure does not replace this. |

Budget (mainnet, approximate): ~0.05 SOL mint + metadata + ATAs, ~0.2 SOL Raydium
pool creation, plus whatever SOL and BRUH you deposit as liquidity. Pool creation
cost is separate from the liquidity itself.

Links
- Solana token quickstart: https://solana.com/developers/guides/getstarted/how-to-create-a-token
- spl-token CLI: https://spl.solana.com/token
- Solana Playground (browser, no local install): https://beta.solpg.io
- Squads: https://squads.so
- Raydium docs: https://docs.raydium.io

---

## 1. Environment

```bash
# install Solana CLI + spl-token
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
cargo install spl-token-cli   # or: npm i -g @solana/spl-token-cli

# devnet first
solana config set --url https://api.devnet.solana.com
solana-keygen new -o ~/bruh-dev-authority.json   # DEV key only
solana airdrop 2
```

**Caveats**
- Never use a production treasury key on a dev machine, and never commit any
  keypair JSON to this repo.
- Public RPC endpoints rate-limit hard. For mainnet use a paid RPC (Helius,
  QuickNode, Triton) — a dropped transaction mid-mint is recoverable, a dropped
  transaction mid-authority-revoke is confusing at best.

---

## 2. Create the mint (original SPL Token Program)

```bash
spl-token create-token \
  --program-id TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA \
  --decimals 6
# => Creating token <MINT_ADDRESS>
```

`TokenkegQfeZ...` is the original SPL Token Program. Do **not** pass the
Token-2022 program id — Token-2022 extensions (transfer fee, transfer hook,
permanent delegate) must be chosen at creation and cannot be added later, and we
have locked them out on purpose.

**Caveats**
- 6 decimals is permanent. It matches the app's fee math (base-unit integers,
  floored fee).
- Save the mint address and every transaction signature now. The mint address is
  the single value the app trusts (`BRUH_TOKEN_MINT`).

---

## 3. Metadata (Metaplex Token Metadata)

Upload the image and a JSON file to durable storage (Arweave via Irys, or pinned
IPFS). Never a temporary URL.

```json
{
  "name": "BRUH",
  "symbol": "BRUH",
  "description": "Utility token for BRUH Legends — Telegram call tracking and tipping.",
  "image": "https://arweave.net/<image-tx-id>",
  "external_url": "https://<your-domain>"
}
```

Then attach it with Metaplex (`mpl-token-metadata` JS, or Metaboss).

- Metaplex docs: https://developers.metaplex.com/token-metadata
- Irys (Arweave uploads): https://irys.xyz
- Metaboss: https://metaboss.rs

**Caveats**
- Keep metadata update authority in Squads for now so you can fix the image or
  URL without touching supply. Decide on immutability after the brand settles.
- Wallets and Jupiter cache token images aggressively; get it right the first time.

---

## 4. Mint the fixed supply into allocation wallets

```bash
spl-token create-account <MINT>            # ATA for the receiving wallet
spl-token mint <MINT> <AMOUNT>             # human units, 6 dp applied
spl-token transfer <MINT> <AMOUNT> <DEST> --fund-recipient
```

Split into publicly identifiable wallets: liquidity reserve, rewards reserve,
operating treasury, team (vested), partnerships, community.

**Caveats**
- `--fund-recipient` costs ~0.002 SOL per new ATA. Fine, just budget it.
- Verify **every** balance with `spl-token accounts` before step 6. After
  revocation you cannot mint a forgotten allocation.
- Team allocation goes into a vesting contract (Streamflow: https://streamflow.finance),
  not a plain wallet, if you have promised vesting publicly.

---

## 5. Move authorities to Squads

```bash
spl-token authorize <MINT> mint   <SQUADS_VAULT>
spl-token authorize <MINT> freeze <SQUADS_VAULT>
```

Interim step so no single laptop key controls supply while you verify allocations.

---

## 6. Revoke authorities (irreversible)

```bash
spl-token authorize <MINT> mint   --disable
spl-token authorize <MINT> freeze --disable
spl-token display <MINT>   # confirm both show "(not set)"
```

**Caveats**
- Do this only after allocations, vesting and metadata are verified.
- Freeze revocation matters for us specifically: a frozen recipient account would
  turn a confirmed tip into a stuck tip, which breaks the non-custodial promise.
- Metadata update authority stays with Squads — that is separate and fine.

---

## 7. Create the canonical Raydium CPMM pool

Raydium UI → Liquidity → Create Pool → **Standard AMM (CPMM)**:
https://raydium.io/liquidity/create-pool

| Field | Value |
|---|---|
| Base token | Official BRUH mint (paste the address, do not search by symbol) |
| Quote token | SOL |
| Pool type | Standard AMM / CPMM (not CLMM) |
| Fee tier | 0.25% |
| Initial deposit | Sets the initial price — see below |

Initial price is defined purely by the deposit ratio:

```text
price (SOL per BRUH) = SOL deposited / BRUH deposited
token price (USD)    = target circulating market cap / circulating supply
required SOL         = BRUH deposited * BRUH price / SOL price
```

Example: 100,000,000 BRUH + 100 SOL → 1 SOL buys 1,000,000 BRUH.

**Caveats**
- CPMM, not CLMM. A CLMM position drifting out of range would make the app's
  "Acquire BRUH" step fail intermittently.
- 1% fee tier discourages the small swaps tipping depends on. 0.25% is the default
  Raydium suggests for volatile pairs and the right call here.
- Do **not** launch with novelty liquidity. The $2-pool example in the notes is
  the failure mode: price is meaningless and a $10 tip is impossible.
- One pool only at launch. A simultaneous BRUH/USDC pool splits depth; Jupiter can
  route USDC → SOL → BRUH through the canonical pool anyway.
- Once created you cannot change the fee tier — you would have to create a new pool.

---

## 8. Test the market before locking anything

- Confirm the pool address resolves to the official mint on both Raydium and
  https://jup.ag and https://dexscreener.com/solana/<pool>.
- Do one very small buy and one very small sell.
- Measure price impact at $5 / $10 / $25 / $50 / $100. If $100 moves price
  absurdly, add liquidity before launch, not after.
- Confirm wallet display: name, symbol, image, 6 decimals.
- Confirm the app recognises only the official mint (it reads a single
  server-side `BRUH_TOKEN_MINT`; a look-alike mint is structurally rejected).

**Caveat**: DexScreener may take a few minutes to index a brand-new pool, and
will show a fresh pool with a scary risk banner until it has history. Expected.

---

## 9. Lock core liquidity (Burn & Earn — irreversible)

Raydium Burn & Earn permanently locks a CPMM LP position and issues a
transferable **Fee Key NFT** that retains the fee-claim rights.
Docs: https://docs.raydium.io/raydium/pools/burn-and-earn

Recommended split:
1. Core position → Burn & Earn, permanently locked.
2. Smaller operational position → held in Squads, removable.
3. Publish both addresses and the policy.

**Caveats**
- The locked underlying liquidity can never be withdrawn. Only do this after
  step 8 passes.
- Whoever holds the Fee Key NFT owns the fee stream. Keep it in the Squads vault,
  never a hot wallet.
- The Fee Key is a **second revenue stream, separate from the app's 1% service
  fee**. Two income sources means two disclosures — the terms page currently
  discloses only the service fee, so it needs an update before launch.
- Never describe unlocked liquidity as locked.

---

## 10. Wire it into BRUH Legends

In order:

1. Set `BRUH_TOKEN_MINT` to the official mint address (server secret).
2. Record the canonical pool address for quoting/routing sanity checks.
3. Flip the BRUH row in `supported_assets` to enabled.
4. Ship the gated buy / cash-out swap path — the 1% service fee (`FEE_BPS`,
   treasury address, `fee_events` ledger) is already built and waiting.

The mint is never user-supplied and must never become user-supplied. That is the
spoof-token defence.

---

## Publish checklist

- [ ] Mint address, pool address, treasury address, lock address published
- [ ] Allocation wallets labelled publicly
- [ ] Vesting contracts verifiable on-chain
- [ ] Terms page discloses both the 1% service fee and Fee Key fee income
- [ ] Devnet rehearsal completed end to end
- [ ] Jurisdiction-specific legal review completed
