# Controlled devnet pilot

Status: NOT RUN. This is the next live test, not launch readiness or a funded reward campaign.

## Owner actions

Use two Telegram accounts in one controlled group, each with its own wallet. Open the Mini App from the bot, select that group, and complete each wallet-ownership challenge. Keep keys and seed phrases in the wallet only; no secrets should be pasted into chat. Use devnet SOL only. Reply to the recipient's group message with `/tip <amount> SOL`, inspect the amount, recipient, network and fees, then authorize only in the sender's wallet. Do not sign if anything is wrong or the wallet shows mainnet.

After the first successful tip, report the test time and whether both Telegram and Mini App showed confirmation. Operator verification should use the existing authenticated audit/storage path; public records contain only sanitized outcomes. No screenshots of credentials or personal chat records are necessary.

## Operator checks

| Check | Required evidence | Current state |
| --- | --- | --- |
| Identity and group | Each session owns its selected membership; both wallets belong to the intended group | NOT RUN live |
| Wallet ownership | One-time challenge consumed; no server signing; replacement delay respected | NOT RUN live |
| Transaction | Devnet genesis/network, exact recipient, mint/SOL, amount and unique reference | NOT RUN live |
| Confirmation | Server-observed confirmed transaction; one receipt, intended status and audit trail | NOT RUN live |
| Replay | Repeat verification produces no second credit/notification | NOT RUN live |
| Isolation | A different group cannot use the first group's wallet association or inspect personal records | NOT RUN live |
| Failure | Unpaid expired intent cannot become confirmed; wrong amount/recipient/reference cannot count | Source/SQL coverage only; live NOT RUN |
| Points | No active season: zero points, no reward or BRUH balance claim; devnet volume cannot farm points | Cloud reports zero seasons; live UI NOT RUN |
| Privacy | Private tip is not publicly broadcast; export excludes other members; opt-out excludes future earning | Source coverage only; live NOT RUN |

The pending atomic-settlement PR #32 requires separate managed validation and multi-session contention testing before real-funds readiness. Do not apply it as an incidental pilot action. No CHAD funding, BRUH mint, airdrop or mainnet transaction is part of this test.

## Stop conditions

Pause the pilot on a network mismatch, incorrect recipient/amount, ambiguous ownership, duplicate credit, exposed private data or missing audit evidence. Preserve existing records; correct with reviewed commits/audit events rather than deleting history. Keep mainnet disabled. An owner-signed successful devnet tip is necessary evidence, but not an independent security review.
