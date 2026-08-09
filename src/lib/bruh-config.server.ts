/**
 * Server-only BRUH configuration. Every value is read at call time, never at
 * module scope, because env is injected per-request in the worker runtime.
 */

export type BruhConfig = {
  network: "mainnet-beta" | "devnet";
  rpcUrl: string;
  /** BRUH SPL mint. Empty until the token is minted; token tipping stays off. */
  bruhMint: string;
  bruhTippingEnabled: boolean;
  /** Emergency flag allowing direct SOL/USDC tips (addendum section 1). */
  directAssetTipsEnabled: boolean;
  tipIntentTtlMinutes: number;
  walletReplacementDelayMinutes: number;
};

const DEVNET_RPC = "https://api.devnet.solana.com";
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

export function getBruhConfig(): BruhConfig {
  const network = (process.env["SOLANA_NETWORK"] === "devnet" ? "devnet" : "mainnet-beta") as
    | "mainnet-beta"
    | "devnet";
  const bruhMint = process.env["BRUH_TOKEN_MINT"] ?? "";

  return {
    network,
    rpcUrl:
      process.env["SOLANA_RPC_URL"] ?? (network === "devnet" ? DEVNET_RPC : MAINNET_RPC),
    bruhMint,
    bruhTippingEnabled: bruhMint.length > 0,
    directAssetTipsEnabled: true,
    tipIntentTtlMinutes: 20,
    walletReplacementDelayMinutes: 30,
  };
}

export const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const MILESTONES = [2, 5, 10, 25, 50, 100] as const;
