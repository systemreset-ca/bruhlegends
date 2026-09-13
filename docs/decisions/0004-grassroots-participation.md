# Grassroots participation and public evidence

Date: 2026-09-13. Status: accepted owner direction; implementation tracked separately.

## Decision

Product first. No presale, escrow or advance token fundraising. Build a Telegram-native tipping, calling and reputation community, then introduce one canonical BRUH mint when ready. A two-to-three-month community-building window is a planning target, not a promised launch date. An owner-selected market window follows readiness; there is no automatic SOL-price trigger.

Early users earn allocation points under published, versioned rules toward a future community pool. Points are not tokens, an on-chain wallet balance, a fixed BRUH quantity or guaranteed monetary value. Publish the pool, conversion and snapshot terms before final allocation. Recognize verified tips, sustained activity, legitimate calls and verified group referrals; genuine beta testers may receive a capped bonus. Faucet-funded test volume must never create unlimited allocation credit.

Phase-1 application fees remain off. Reconcile the historical 1% buy/sell decision against the later illustrative additional service fee before Phase 2; neither is an enabled beta fee. CHAD mint `PZUbFxtuydyLP2JEwCmvWc1p1NHxWsqBYuEoVbcnQA3` is under evaluation, not approved. CHAD and seasonal rewards must be generic configuration, never protocol dependencies. Automatic rewards require funded, reviewed on-chain execution and wallet authorization; no server signing or unattended key custody.

Preserve verified Telegram identity, group isolation, ownership proofs, confirmed transfer matching, audit history, explicit database privileges and mainnet gates. Energetic marketing does not remove these safeguards. Do not invent supply, economics, dates, guaranteed demand or completed liquidity locks.

## Milestones

| Milestone | Deliverable | Exit evidence |
| --- | --- | --- |
| A: reliable beta | Complete settlement concurrency/Cloud validation and two-account devnet test; improve mobile linking; build append-only participation ledger and bounded tester recognition | Adversarial transaction and identity tests; duplicate/cap/correction database tests; signed devnet receipts |
| B: community season | Approved earning rules, group-scoped credits view, opt-in public aggregates; controlled mainnet pilot | Versioned rules, caps/farming controls, privacy/export coverage and reviewed pilot approval |
| C: token readiness | Supply, community pool, conversion/snapshot rules, treasury separation, distribution and liquidity policies | Published approved policy and reviewed funded execution; no presale |
| D: launch | One canonical mint, approved allocation snapshot/distribution, primary BRUH/SOL liquidity; optional USDC/CHAD only with sufficient funding/depth | Mint, distribution receipts, treasury reconciliation and verifiable lock evidence |
| E: utility | Wallet-authorized BRUH routing/settlement, disclosed configurable fees and campaign stacking | Quote/slippage/replay tests, reviewed mint registry and staged rollout evidence |

## Ledger requirements for the next slice

Use group/member identities tied to `(telegram_chat_id, telegram_user_id)`. Every award has a unique verified source event, season and rule version. Apply daily/member/recipient-pair/season caps atomically, including under concurrent requests. Raw spending alone is not eligibility. Distinguish pending, awarded and held events; adjustments are appended with reason/actor/source, not destructive edits. Separate this ledger from caller BRUH Score and on-chain token holdings. Wallet verification is required before allocation finalization; never substitute another group's wallet.

No earning season activates without approved weights, caps, eligibility and tester policy recorded durably. Final distribution uses frozen, reconciled allocations and prevents duplicate claims. No mint/treasury transaction is server-signed. Include export, anonymization, controlled writes, RLS and explicit grants before enabling ledger storage.

## Website and communications

Stages: working product; early participation; BRUH preparation; launch/utility. Stage labels must track tested/deployed capabilities. Use `TIP A BRUH. BECOME A CHAD.` with verified progress and opt-in alerts. Prepare two substantive weekly posts, monthly metrics/progress, onboarding guides, press materials and milestone releases. Do not spam command replies or promise appreciation, universal buying, guaranteed allocation or fake scarcity. No paid commitments are authorized by this schedule.

## Complete revision history

Preserve all published Git commits and historical specs. No force-push, rebase, amend or squash of published history. Every material task needs an issue/milestone, PR, validation, limitations and exact SHA. A production release needs source SHA, migration/config state, deployment verification and rollback instructions. A merge is not deployment evidence.

Public evidence follows proposal → code → review → tests → deployment → on-chain receipts. Publish earning-rule revisions and allocation manifests without exposing Telegram identities or private user data. Distinguish planned, implemented, tested and live. GitHub history supports inspection; it is not a security certification.

The repository was previously private. Public access remains unverified in this slice. Before changing visibility, review tracked content and full history for credentials, personal data and sensitive security material; rotate any exposed secrets. Do not rewrite the private history to hide findings. If safe full publication is impossible, retain the complete private history and publish a documented safe evidence repository, clearly disclosing the limitation. No public-access claim until an unauthenticated check succeeds.

## Superseded proposals and implementation status

The chat's six-month presale/refundable-escrow proposal is superseded. Preserve original token/mint/fee drafts as historical inputs, not launch authorization. This slice commits the new direction and builds inactive credits/status surfaces. It does not implement the award ledger, approve economics, deploy contracts, enable mainnet, create a mint or distribute rewards.
