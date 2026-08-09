/**
 * Market data provider adapter. DexScreener is the primary source (it carries
 * pool + liquidity depth); Jupiter is the secondary, used both as a failover
 * price source and as a cross-check so a single bad feed cannot set a baseline
 * or fire a milestone. Neither path ever manufactures a price.
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
const JUPITER = "https://lite-api.jup.ag/price/v3";

/** Fraction by which two providers may disagree before an observation is untrusted. */
export const PRICE_DISAGREEMENT_TOLERANCE = 0.25;

/**
 * Pure comparison used by the cross-check. Relative difference is measured
 * against the smaller price so a 10x feed error can never look small.
 */
export function pricesAgree(
  a: number | null | undefined,
  b: number | null | undefined,
  tolerance = PRICE_DISAGREEMENT_TOLERANCE,
): boolean {
  if (!a || !b || a <= 0 || b <= 0) return false;
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return (high - low) / low <= tolerance;
}

export async function fetchDexScreenerSnapshot(mint: string): Promise<TokenSnapshot | null> {
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
    console.error("DexScreener provider error", error);
    return null;
  }
}

/** Secondary provider: price only, no pool or liquidity depth. */
export async function fetchJupiterSnapshot(mint: string): Promise<TokenSnapshot | null> {
  try {
    const response = await fetch(`${JUPITER}?ids=${mint}`);
    if (!response.ok) {
      console.error(`Jupiter failed [${response.status}] for ${mint}`);
      return null;
    }
    const json = (await response.json()) as Record<string, { usdPrice?: number } | undefined>;
    const price = json?.[mint]?.usdPrice;
    if (typeof price !== "number" || !(price > 0)) return null;

    return {
      mint,
      symbol: null,
      name: null,
      poolAddress: null,
      priceUsd: price,
      marketCapUsd: null,
      liquidityUsd: null,
      provider: "jupiter",
      raw: json[mint],
    };
  } catch (error) {
    console.error("Jupiter provider error", error);
    return null;
  }
}

export type CheckedSnapshot = {
  snapshot: TokenSnapshot;
  /** `agree` = both providers matched, `single` = only one answered, `disagree` = untrusted. */
  crossCheck: "agree" | "single" | "disagree";
  secondaryPriceUsd: number | null;
};

/**
 * Reads both providers. The primary sets identity and liquidity; the secondary
 * either confirms the price, stands in when the primary is down, or flags the
 * observation as untrusted.
 */
export async function fetchCheckedSnapshot(mint: string): Promise<CheckedSnapshot | null> {
  const [primary, secondary] = await Promise.all([
    fetchDexScreenerSnapshot(mint),
    fetchJupiterSnapshot(mint),
  ]);

  if (!primary || primary.priceUsd === null) {
    if (!secondary) return null;
    return { snapshot: secondary, crossCheck: "single", secondaryPriceUsd: secondary.priceUsd };
  }

  if (!secondary || secondary.priceUsd === null) {
    return { snapshot: primary, crossCheck: "single", secondaryPriceUsd: null };
  }

  return {
    snapshot: primary,
    crossCheck: pricesAgree(primary.priceUsd, secondary.priceUsd) ? "agree" : "disagree",
    secondaryPriceUsd: secondary.priceUsd,
  };
}

/** Primary with secondary failover; identity fields may be null on failover. */
export async function fetchTokenSnapshot(mint: string): Promise<TokenSnapshot | null> {
  const checked = await fetchCheckedSnapshot(mint);
  return checked?.snapshot ?? null;
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
