# Trojan-based wallet handling and sensitive-action protection

Date: 2026-09-14. Status: owner-directed reference architecture; not implemented security parity.
Owner instruction: use Trojan's established wallet/security flows as the reference instead of inventing a new product interaction model. Work remains in the original BRUH project. Baseline source: `97b388073899f54003c148fbca5e0b2d2339e415`.

## Verified reference behavior

Official documentation inspected on this date:

- [Account Security](https://docs.trojanonsolana.com/telegram-bot-user-guide/trojan-bot-settings/account-security): a separate Secure Action Password (SAP) protects withdrawals and private-key export once configured. The documented SAP cannot be reset; users can set a hint.
- [Wallets](https://docs.trojanonsolana.com/telegram-bot-user-guide/trojan-bot-settings/wallets): wallet selection, deliberate export/show steps, SAP where applicable, generated wallets, private-key import and transfers to selected destinations.
- [Terminal wallet management](https://docs.trojan.com/trading-on-trojan/wallet-management): generated/imported wallets, primary-wallet selection, archival, explorer links and deliberate export.
- [Using Trojan](https://docs.trojanonsolana.com/about-trojan-on-solana/using-trojan-on-solana): encrypted private keys and user export of generated hot wallets are described.
- [Privacy policy](https://trojanonsolana.com/privacy), section 13: encrypted wallet credentials may be stored with authorization for transaction signing. Treat this as a disclosed trust model, not a independently verified custody implementation.

The public material inspected does not establish the actual encryption algorithm, key-management service, staff access, password hashing, recovery implementation, deployment isolation or signing authorization internals. Do not infer or market BRUH as using the identical backend or equivalent audited security. The tutorials' broad key-access claims and privacy policy's credential-storage description are not sufficient to settle those implementation details.

## BRUH mapping

| Reference pattern | BRUH requirement | Current state |
| --- | --- | --- |
| Generated hot wallet owned by the account | One encrypted internal wallet per verified Telegram account per network, shared across groups | Devnet creation/show published |
| Wallet address and explorer access | Private account wallet display and devnet explorer link; exact on-chain receipts | Display published; spending receipts not live |
| Separate SAP for sensitive actions | Independent action password, distinct from Telegram login, required before withdrawal or key export | Not implemented |
| Deliberate export/show steps | Fresh SAP verification and explicit reveal in an authenticated private app; no key posted to Telegram | Not implemented |
| Transfer destination and amount selection | Immutable destination/amount/fee confirmation, account-bound authorization and durable settlement | Not implemented |
| Wallet archival | Balance-safe retirement, reject pending spends, preserve audit and recovery access | Not implemented |

The owner's two-role model is retained: an account may register one verified external public withdrawal destination using private `/wallet add <address>`; BRUH also generates its internal wallet using `/start` or planned `/generate` alias. Adding an external public address never grants BRUH signing authority over that external wallet. Its ownership-verification and replacement flow is not implemented yet. Existing membership-scoped external linking is not this new account-wide destination registry.

Trojan's private-key import and multiple-wallet features are not copied: BRUH's accepted scope remains one active internal wallet and no user private-key import. Group calls/stats/leaderboards remain isolated; wallet identity is shared. Telegram two-step verification can be recommended, never claimed as proven by Bot API.

## Implementation requirements

Use standard, maintained cryptographic/authentication libraries. Do not implement a custom password hash, invent a proprietary vault, or choose a storage provider based solely on Trojan marketing claims.

1. SAP setup and verification happen in the authenticated private app, not ordinary Telegram messages. Store a salted password verifier using an established password KDF; never plaintext SAP, keys or seed phrases in chat/logs. Keep password authorization separate from wallet wrapping-key management.
2. Require fresh, action-bound SAP verification for withdrawals, destination replacement, key reveal/export, wallet retirement and security-setting changes. Approvals bind account, wallet, operation, destination, amount and expiry, are single-use, and are consumed server-side. Telegram buttons cannot supply a trusted user identity or override frozen intent fields.
3. Tipping also spends funds: do not imply a withdrawal password alone prevents a compromised Telegram account from draining funds through tips. Implement short authorized spending sessions and explicit per-tip confirmations/limits; final expiry/limits must be recorded before activation. Do not prompt for SAP on every routine command or balance read.
4. Rate-limit failed SAP attempts and sensitive actions; persist attempt/lock state, authorization consumption and audit events. Hints must not contain the password. Notifications never include secrets and notification delivery is not the security gate.
5. No silent support/admin password-reset bypass. Trojan documents a non-resettable SAP; BRUH must disclose its recovery behavior and define a reviewed backup/recovery path before funds depend on it. Do not enable a reset endpoint that turns Telegram login alone into export/withdraw authority.
6. Preserve encrypted key custody, confirmed exact transaction proof, fee-inclusive reservations, signed-before-broadcast persistence, replay protection and immutable audit. Export copies a key; it does not revoke BRUH's copy. Describe that honestly and require explicit wallet retirement to disable future BRUH signing after outstanding activity is resolved.
7. Mainnet/spending/export/retirement remain gated until their actual implementation and validation are complete. The existing shared-worker/admin and platform-role trust limits remain recorded; this reference does not remove them or create a new Guardian dependency.

## Delivery tracking

[Wallet issue45](https://github.com/systemreset-ca/bruhlegends/issues/45) remains milestone A's delivery tracker. Next slices: account-wide external destination plus `/generate` alias; SAP private setup/action verification; owner-bound devnet tip intent/reservation/signing/settlement; sensitive withdrawals/export/retirement. Use acceptance tests for wrong account, wrong action/destination/amount, stale/replayed approvals, password failure/lockout, concurrent consumption, and retained audit. No new secrets or provider account are requested by this documentation decision.
