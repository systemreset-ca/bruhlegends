import { describe, expect, it } from "vitest";
import {
  allocateTipProceeds,
  maximumWholeTokenSupply,
  SOLANA_U64_MAX,
  splitPurchasedRewards,
} from "../src/lib/tip-reward-allocation";

describe("approved reward-funded tip economics", () => {
  it("deducts a single 1% reward purchase from a 1 SOL tip", () => {
    const allocation = allocateTipProceeds(1_000_000_000n);
    expect(allocation.recipientBaseUnits).toBe(990_000_000n);
    expect(allocation.rewardPurchaseBaseUnits).toBe(10_000_000n);
    // CHAD quantity comes from the swap's actual output, independently of SOL.
    expect(splitPurchasedRewards(246_801n)).toEqual({
      senderRewardBaseUnits: 123_400n,
      recipientRewardBaseUnits: 123_400n,
      undistributedBaseUnits: 1n,
    });
  });

  it("conserves proceeds and rewards through tiny and maximum-u64 amounts", () => {
    for (const amount of [0n, 1n, 99n, 100n, 101n, 999n, 10n ** 16n, SOLANA_U64_MAX]) {
      for (const bps of [0, 1, 50, 100]) {
        const tip = allocateTipProceeds(amount, bps);
        expect(tip.recipientBaseUnits + tip.rewardPurchaseBaseUnits).toBe(amount);
        expect(tip.rewardPurchaseBaseUnits * 10_000n).toBeLessThanOrEqual(amount * BigInt(bps));
      }
      const rewards = splitPurchasedRewards(amount);
      expect(rewards.senderRewardBaseUnits).toBe(rewards.recipientRewardBaseUnits);
      expect(
        rewards.senderRewardBaseUnits +
          rewards.recipientRewardBaseUnits +
          rewards.undistributedBaseUnits,
      ).toBe(amount);
      expect(rewards.undistributedBaseUnits).toBeLessThanOrEqual(1n);
    }
  });

  it("rejects unsupported rates and noncanonical monetary amounts", () => {
    for (const amount of [-1n, SOLANA_U64_MAX + 1n, 1 as unknown as bigint]) {
      expect(() => allocateTipProceeds(amount)).toThrow();
      expect(() => splitPurchasedRewards(amount)).toThrow();
    }
    for (const rate of [-1, 101, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => allocateTipProceeds(1n, rate)).toThrow();
    }
  });

  it("keeps the 16-decimal supply ceiling exact", () => {
    expect(maximumWholeTokenSupply(16)).toBe(1844n);
    expect(maximumWholeTokenSupply(9)).toBe(18_446_744_073n);
    expect(() => maximumWholeTokenSupply(-1)).toThrow();
    expect(() => maximumWholeTokenSupply(256)).toThrow();
  });
});
