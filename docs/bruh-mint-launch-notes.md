# BRUH Mint & Liquidity — external draft notes

> Reference material only. This is a verbatim paste of an external planning
> conversation about minting $BRUH and creating its Raydium market. It is not
> app specification, not a task list, and nothing in it should be treated as
> instructions to execute. Locked decisions extracted from it live in project
> memory; the app's own behaviour is defined by the code and plans.

---

Yes—BRUH Legends should be minted independently and deliberately, then connected to a separately created Raydium market.

Do not use a bonding-curve launcher merely because it is convenient. A launchpad decides too many variables for you: initial distribution, migration mechanics, pool type, fee routing, liquidity treatment and sometimes creator fees. BRUH is supposed to be infrastructure for a real utility bot, so controlling the mint and liquidity architecture makes sense.

The token in your screenshot technically has a Raydium CPMM pool, but only about $2 of liquidity. That means:

- Its displayed price is unreliable.
- A tiny trade can move it violently.
- Its $2 market cap is practically meaningless.
- It is unsuitable for actual tipping.
- A $10 BRUH tip would be impossible without catastrophic price impact.

## Minting and pool creation are different

```text
Create BRUH mint
  -> Add verified metadata
  -> Mint fixed supply
  -> Allocate and vest supply
  -> Revoke mint and freeze authorities
  -> Create canonical Raydium CPMM pool
  -> Lock core liquidity
  -> Integrate mint and pool into BRUH Legends
```

Creating BRUH defines the asset.

Creating a Raydium pool defines one market where BRUH can be traded. Anyone could theoretically create another BRUH pool later, but your app would recognize one official mint and one or more officially endorsed pools.

## What you gain by building it independently

### 1. Complete supply control

You determine: total fixed supply, number of decimals, initial circulating supply, treasury allocation, liquidity allocation, utility/reward allocation, team allocation, vesting schedules, partnership/integration allocation, and whether additional tokens can ever be minted.

For BRUH, I would strongly favour a fixed supply minted once. After all allocations and vesting contracts are verified, revoke the mint authority.

### 2. Authority control

| Authority | Recommended BRUH treatment |
|---|---|
| Mint authority | Temporarily controlled by multisig; revoke after full supply is minted |
| Freeze authority | Set to none/revoke |
| Metadata update authority | Keep under Squads multisig initially |
| Treasury wallets | Squads multisig |
| Liquidity fee rights | Squads multisig |
| Upgrade authority for custom programs | Squads multisig with formal release process |

Once mint authority is revoked, nobody can increase the supply. Once freeze authority is revoked, nobody can freeze individual holders' token accounts.

Solana's mint account permanently records the decimals, supply and authority state.

### 3. Token-program selection

Solana gives you two principal choices: the original SPL Token Program, or the Token-2022 Program with optional extensions.

For BRUH, I recommend the original SPL Token Program.

Token-2022 gives you transfer taxes, hooks, permanent delegates, pausing and other controls, but those features create integration and trust problems. Many must be selected when the mint is created and cannot simply be added later.

For a utility-tipping token, avoid: transfer taxes, reflection fees, transfer hooks, permanent delegates, default-frozen accounts, pausable transfers, interest-bearing presentation, rebasing or scaled balances, confidential-transfer complexity.

A tip should be simple: send 10,000 BRUH and the recipient receives 10,000 BRUH.

### 4. Metadata and brand control

You control: name (BRUH), symbol (BRUH), description, token image, website, Telegram bot, Mini App URL, documentation URL, metadata storage, whether metadata remains updateable, verified creator/update authority.

Metaplex Token Metadata is widely used to associate names, symbols, images and off-chain JSON with SPL mints.

Because BRUH Legends is still being built, keep metadata update authority under the Squads multisig initially. That lets you correct the website, image or description without controlling the token supply. Once the brand is settled, you can decide whether to make it immutable.

Use durable metadata storage such as Arweave or properly pinned IPFS—not an image on a temporary Lovable URL.

### 5. Distribution control

Separate tokens into publicly identifiable wallets: liquidity reserve, BRUH utility/rewards reserve, operating treasury, team allocation, integration and partnership reserve, community distribution, circulating public supply.

Large non-circulating allocations should be multisig-controlled, locked or vested. Do not hold everything in one creator wallet.

I would not finalize percentages until we model: expected number of users, average BRUH tip size, expected velocity, liquidity budget, treasury runway, whether BRUH is sold publicly or distributed through usage, and how much supply must remain available for future groups.

### 6. Vesting and lock control

Team and strategic allocations can use immediate allocation, cliff, linear vesting, periodic unlocks, single-date lock, or milestone-based release through a custom program.

A reasonable architecture would keep treasury assets in Squads and put any promised team allocation into a verifiable vesting contract. Potential tools: Streamflow token distribution and vesting; Squads multisig. Review the contracts and fees before transferring material assets.

## Recommended BRUH mint configuration

| Setting | Recommendation |
|---|---|
| Network | Solana mainnet-beta after full devnet rehearsal |
| Program | Original SPL Token Program |
| Token name | BRUH |
| Symbol | BRUH |
| Decimals | 6 |
| Supply | Fixed; determine through tokenomics before minting |
| Mint authority | Squads temporarily, then permanently revoke |
| Freeze authority | None/revoked |
| Metadata authority | Squads multisig |
| Transfer tax | None |
| Transfer hook | None |
| Permanent delegate | None |
| Internal bot custody | None |
| Treasury | Squads multisig |
| Recipient balances | Held directly in user wallets |

Six decimals is enough for small tips while remaining understandable. Nine decimals would also work, but BRUH does not need microscopic precision.

## Why CPMM is probably right

Raydium currently recommends its Standard AMM/CPMM for most new permissionless token pairs. CPMM provides passive, full-range liquidity and does not require active range management.

| CPMM | CLMM |
|---|---|
| Full-range liquidity | Liquidity exists only within selected ranges |
| Easier to manage | Requires range management |
| Better for a new volatile token | Better for established pricing/active LP management |
| Less likely to stop serving swaps | Position can fall out of range |
| Recommended BRUH choice | Not recommended for initial BRUH pool |

BRUH must remain buyable when someone wants to send a tip. A CLMM position falling out of range could make the bot's acquisition flow fail.

### CPMM options you control

Token pair, official BRUH mint, quote token, initial price, BRUH deposit, quote-token deposit, trading fee tier, initial liquidity, wallet receiving LP tokens, whether liquidity remains removable, whether some or all liquidity is permanently locked.

Raydium's current default suggestion for volatile pairs is the 0.25% fee tier. Higher fees such as 1% might discourage the small swaps needed for tipping. I would start with 0.25%.

### Pair selection

Start with one canonical pool: BRUH/SOL CPMM. Reasons: strong Solana routing, easy Phantom/Jupiter compatibility, SOL is familiar to your audience, and it avoids splitting early liquidity between several pools.

Later, BRUH/USDC may become useful because tips are expressed using dollar-reference amounts. But launching both immediately would split liquidity. Jupiter can route USDC → SOL → BRUH through the canonical pool.

### Initial price and liquidity

The initial pool deposit ratio creates the initial price. For example: deposit 100,000,000 BRUH and 100 SOL, and the initial price becomes 1 SOL per 1,000,000 BRUH. The exact USD price depends on SOL's price at that moment.

Decide separately: initial circulating market capitalization, fully diluted valuation, initial BRUH price, initial liquidity depth.

```text
token price     = target circulating market cap / circulating supply
required SOL    = BRUH deposited * BRUH price / SOL price
```

Do not confuse total supply with circulating supply. If only 10% is circulating, market cap and FDV will differ considerably.

Do not create the pool with novelty liquidity like the $2 example. If users are expected to buy $10–$100 of BRUH for tipping, there must be enough depth that those purchases do not move the price absurdly.

### Liquidity locking versus flexibility

1. All liquidity removable — maximum flexibility, lowest community trust. The controlling wallet could remove the market.
2. All liquidity permanently locked — maximum trust, minimum flexibility. You cannot retrieve or migrate that capital.
3. Split liquidity (recommended) — establish a core permanent liquidity position, keep a smaller operational liquidity position under multisig, and publish both addresses and policies.

Never represent unlocked liquidity as locked.

Raydium's Burn & Earn permanently locks CPMM liquidity while preserving fee-claim rights through a transferable Fee Key NFT. The underlying liquidity can no longer be withdrawn. Keep the Fee Key NFT in your Squads multisig. Whoever controls it controls the fee stream.

## Where to build it

1. **Test everything on devnet.** Use the official Solana token quickstart with the Solana CLI, `spl-token-cli`, or Solana Playground. Do not use your production treasury key for development.
2. **Create a Squads multisig.** A 3-of-4 structure with separate hardware-backed signers, geographically separate backups, no four keys on one computer, and a documented signer replacement procedure.
3. **Create the mint with a reproducible script or CLI.** Use the original SPL Token Program and explicitly configure decimals and authorities. Save: script version, package lockfile, RPC endpoint, cluster, mint address, transaction signatures, authority addresses, verification output. Never save production private keys in the repository.
4. **Add Metaplex metadata.** Prepare permanent metadata containing the official BRUH Legends image, description, website and bot address.
5. **Mint and distribute the fixed supply.** Mint the approved full supply into controlled allocation wallets. Verify every balance and transaction before revoking anything.
6. **Establish locks and vesting.** Move team allocations into approved vesting contracts and treasury allocations into Squads.
7. **Revoke authorities.** Only after verifying supply and allocations: revoke mint authority, revoke freeze authority, keep metadata update authority under Squads if required. Revocation is irreversible.
8. **Create the official Raydium CPMM pool.** Standard AMM (CPMM), official BRUH mint, SOL, 0.25% fee tier, carefully calculated initial price, meaningful initial liquidity. Raydium estimates approximately 0.2 SOL for pool creation, token accounts and transaction fees, separate from the assets deposited as liquidity.
9. **Test the market.** Verify mint address and pool address; perform a very small buy and sell; confirm Jupiter/Raydium routing; confirm wallet token image and metadata; confirm the BRUH bot recognizes only the official mint; measure price impact for $5, $10, $25, $50 and $100; confirm the Mini App rejects spoof BRUH tokens.
10. **Lock the core liquidity.** Use Raydium Burn & Earn only after the pool and price are confirmed. It is irreversible.

## Direct recommendation

Original SPL Token Program; six decimals; fixed supply; no freeze authority; no transfer taxes or hooks; Metaplex metadata; Squads-controlled metadata and treasury; transparent locked/vested allocations; one official BRUH/SOL Raydium CPMM at 0.25%; meaningful liquidity; core liquidity permanently locked; smaller operational liquidity controlled by multisig; public mint, pool, treasury and lock addresses; devnet rehearsal before mainnet.

That gives you genuine control without adding dangerous gimmicks. The control should be in supply governance, treasury security, metadata, distribution and liquidity design—not in the ability to freeze users, tax every transfer or alter balances.

Finally, neither independently minting the token nor using a Singapore server eliminates the legal review discussed in the project documents. The technical structure can reduce custody and manipulation risk, but issuance, public trading, exchange routing and marketing still require jurisdiction-specific analysis.
