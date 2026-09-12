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

export type SolanaNetwork = BruhConfig["network"];

const DEVNET_RPC = "https://api.devnet.solana.com";

const DEFAULT_FEE_BPS = 100;
/** Hard ceiling so a bad env value can never quietly tax users into oblivion. */
export const MAX_FEE_BPS = 500;

export function parseFeeBps(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_FEE_BPS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_FEE_BPS;
  return Math.min(Math.floor(value), MAX_FEE_BPS);
}

export function resolveSolanaNetwork(env: NodeJS.ProcessEnv = process.env): SolanaNetwork {
  const requested = env["SOLANA_NETWORK"]?.trim();
  if (!requested || requested === "devnet") return "devnet";
  if (requested !== "mainnet-beta") {
    throw new Error("SOLANA_NETWORK must be devnet or mainnet-beta");
  }
  if (env["SOLANA_MAINNET_ENABLED"] !== "true") {
    throw new Error("Mainnet requires SOLANA_MAINNET_ENABLED=true");
  }
  return "mainnet-beta";
}

export function resolveSolanaRpcUrl(
  network: SolanaNetwork,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env["SOLANA_RPC_URL"]?.trim();
  if (network === "mainnet-beta" && !configured) {
    throw new Error("Mainnet requires an explicit SOLANA_RPC_URL");
  }
  return configured ?? DEVNET_RPC;
}

export function getBruhConfig(): BruhConfig {
  const network = resolveSolanaNetwork();
  const bruhMint = process.env["BRUH_TOKEN_MINT"] ?? "";
  const feeBps = parseFeeBps(process.env["FEE_BPS"]);
  const feeTreasuryAddress = process.env["FEE_TREASURY_ADDRESS"] ?? "";

  return {
    network,
    rpcUrl: resolveSolanaRpcUrl(network),
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
