/**
 * Market data provider adapter. DexScreener is the primary public source; the
 * interface exists so a second provider can be added for cross-checking without
 * touching call logic.
 */

export type TokenSnapshot = {
  mint: string;
  symbol: string | null;
  name: string | null;
  poolAddress: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  provider: string;
  raw: unknown;
};

type DexPair = {
  chainId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
};

const DEXSCREENER = "https://api.dexscreener.com/latest/dex/tokens";

export async function fetchTokenSnapshot(mint: string): Promise<TokenSnapshot | null> {
  try {
    const response = await fetch(`${DEXSCREENER}/${mint}`);
    if (!response.ok) {
      console.error(`DexScreener failed [${response.status}] for ${mint}`);
      return null;
    }
    const json = (await response.json()) as { pairs: DexPair[] | null };
    const pairs = (json.pairs ?? []).filter((pair) => pair.chainId === "solana");
    if (pairs.length === 0) return null;

    // Deepest liquidity wins; dust pools must not set the baseline.
    const best = pairs.reduce((a, b) =>
      (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a,
    );

    return {
      mint,
      symbol: best.baseToken.symbol ?? null,
      name: best.baseToken.name ?? null,
      poolAddress: best.pairAddress ?? null,
      priceUsd: best.priceUsd ? Number(best.priceUsd) : null,
      marketCapUsd: best.marketCap ?? best.fdv ?? null,
      liquidityUsd: best.liquidity?.usd ?? null,
      provider: "dexscreener",
      raw: best,
    };
  } catch (error) {
    console.error("Market provider error", error);
    return null;
  }
}

/** Never manufactures a price: a failed lookup returns null, not zero. */
export async function fetchUsdPrice(mint: string): Promise<number | null> {
  const snapshot = await fetchTokenSnapshot(mint);
  return snapshot?.priceUsd ?? null;
}

const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function fetchSolPrice(): Promise<number | null> {
  return fetchUsdPrice(SOL_MINT);
}
