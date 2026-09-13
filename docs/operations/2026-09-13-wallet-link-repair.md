# Wallet entry-point repair

Owner reported the same failure on two Telegram accounts: `/wallet` returned its linking instructions, but the app button opened the obsolete project Lovable host and displayed Forbidden. This is an entry-point failure before wallet signing, not evidence of a Solana transaction failure.

Source baseline: `158e71ab7305a4858dd408efe9b0f95b261133a8`. `bot.server.ts` used the obsolete host whenever `APP_URL` was absent. The repair defaults to `https://bruh.tips`, treats blank configuration as unset and normalizes whitespace/trailing slashes. Explicit deployment overrides remain supported. Wallet, profile-edit and export buttons share this helper. `/wallet <address>` still requires the ownership-signing flow; clarified copy explains that pasting an address does not link it.

Four command-level regression cases check absent/blank/whitespace configuration and an explicit normalized deployment origin, using only a synthetic login token. Session exchange, group selection and ownership proof are unchanged. No key, seed, funds transfer, database schema, scheduler or mainnet change is involved.

Lovable reported server `APP_URL` was unset and configured it to `https://bruh.tips` through the existing manager, with no other changes. Four command-level regression cases pass locally. Full-suite/type/build CI and publication outcomes and exact SHA must be added when verified. Do not infer deployment success from this source record. Existing buttons already sent to Telegram are immutable; after deployment, a fresh `/wallet` command is needed for a new short-lived login button. Live wallet signing remains owner-operated and unverified.
