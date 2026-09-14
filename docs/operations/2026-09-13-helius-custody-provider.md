# Guardian Helius devnet provider

The owner reports setting `BRUH_DEVNET_API_KEY`, `BRUH_MAINNET_API_KEY` and `SOLANA_RPC_URL` in BRUH Devnet Guardian's secret manager. Treat these credentials as supplied; no additional credential request is needed unless an actual presence/authentication check fails. Values are not recorded here.

Guardian Lovable received the implementation assignment: derive the Helius devnet URL server-side from `BRUH_DEVNET_API_KEY`, reject an optional conflicting/mainnet RPC URL, retain bounded HTTP requests and redirect rejection, and never use the mainnet key or silently fall back to public RPC. The assignment is visibly running; configuration and Helius authentication are not yet verified.

Guardian source reviewed through `66460bc` includes manual redirects with explicit 3xx rejection. This corrects the previously failing request setting without following redirects. Actual deployed Helius read/transfer proof remains outstanding.

The earlier local ephemeral-wallet experiment used public Solana devnet RPC, not Helius. It terminated with `devnet_smoke_not_verified`: external faucet funding was not received within five minutes. No transfer occurred. Its memory-only wallet keys are gone; do not fund the old experiment addresses.

Next proof: actual Helius devnet genesis/blockhash/fee reads, followed by a fresh memory-only wallet experiment with legitimate devnet faucet funding and an exact finalized 0.001 SOL transfer. A CLI experiment establishes that harness, not deployed Telegram wallet onboarding or the Guardian Worker signing flow. Production custody, mainnet and real funds remain inactive.
