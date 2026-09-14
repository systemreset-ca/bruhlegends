/** Exact base-unit accounting only. This does not execute swaps or award rewards. */
export const SOLANA_U64_MAX = (1n << 64n) - 1n;
export const TIP_REWARD_FEE_BPS = 100;

function validAmount(amount: bigint): void {
  if (typeof amount !== "bigint" || amount < 0n || amount > SOLANA_U64_MAX) {
    throw new Error("Amount must be an unsigned Solana base-unit integer.");
  }
}

/** Deduct the reward budget once from SOL, or from actual BRUH swap proceeds. */
export function allocateTipProceeds(grossBaseUnits: bigint, feeBps = TIP_REWARD_FEE_BPS) {
  validAmount(grossBaseUnits);
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 100) {
    throw new Error("Reward fee must be between zero and the approved 100 basis points.");
  }
  const rewardPurchaseBaseUnits = (grossBaseUnits * BigInt(feeBps)) / 10_000n;
  return {
    grossBaseUnits,
    feeBps,
    recipientBaseUnits: grossBaseUnits - rewardPurchaseBaseUnits,
    rewardPurchaseBaseUnits,
  };
}

/** Split actual CHAD received, not estimated market value or promised tokens.
 * An indivisible final unit remains explicit undistributed inventory so both
 * parties receive equal rewards. Reconciliation must retain that unit. */
export function splitPurchasedRewards(actualRewardBaseUnits: bigint) {
  validAmount(actualRewardBaseUnits);
  const equalShare = actualRewardBaseUnits / 2n;
  return {
    senderRewardBaseUnits: equalShare,
    recipientRewardBaseUnits: equalShare,
    undistributedBaseUnits: actualRewardBaseUnits % 2n,
  };
}

/** Maximum whole-token supply at a chosen decimal precision; never use floats. */
export function maximumWholeTokenSupply(decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error("Token decimals must fit an unsigned byte.");
  }
  return SOLANA_U64_MAX / 10n ** BigInt(decimals);
}
