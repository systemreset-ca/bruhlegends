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
  /** Service fee in basis points charged on the buy and sell legs (100 = 1%). */
  feeBps: number;
  /** Treasury that receives the service fee. Empty disables the fee entirely. */
  feeTreasuryAddress: string;
  feeEnabled: boolean;
};

const DEVNET_RPC = "https://api.devnet.solana.com";
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

const DEFAULT_FEE_BPS = 100;
/** Hard ceiling so a bad env value can never quietly tax users into oblivion. */
export const MAX_FEE_BPS = 500;

export function parseFeeBps(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_FEE_BPS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_FEE_BPS;
  return Math.min(Math.floor(value), MAX_FEE_BPS);
}

export function getBruhConfig(): BruhConfig {
  const network = (process.env["SOLANA_NETWORK"] === "devnet" ? "devnet" : "mainnet-beta") as
    | "mainnet-beta"
    | "devnet";
  const bruhMint = process.env["BRUH_TOKEN_MINT"] ?? "";
  const feeBps = parseFeeBps(process.env["FEE_BPS"]);
  const feeTreasuryAddress = process.env["FEE_TREASURY_ADDRESS"] ?? "";

  return {
    network,
    rpcUrl:
      process.env["SOLANA_RPC_URL"] ?? (network === "devnet" ? DEVNET_RPC : MAINNET_RPC),
    bruhMint,
    bruhTippingEnabled: bruhMint.length > 0,
    directAssetTipsEnabled: true,
    tipIntentTtlMinutes: 20,
    walletReplacementDelayMinutes: 30,
    feeBps,
    feeTreasuryAddress,
    feeEnabled: feeTreasuryAddress.length > 0 && feeBps > 0,
  };
}


export const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const MILESTONES = [2, 5, 10, 25, 50, 100] as const;
