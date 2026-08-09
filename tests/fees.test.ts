import { describe, expect, it } from "vitest";
import { splitFee } from "../src/lib/fees.server";
import { parseFeeBps, MAX_FEE_BPS } from "../src/lib/bruh-config.server";

describe("fee split", () => {
  it("takes exactly 1% at base-unit precision", () => {
    // $10 of USDC (6 decimals) => 10_000_000 base units, fee 100_000 = $0.10
    const split = splitFee(10_000_000n, 100);
    expect(split.feeBaseUnits).toBe(100_000n);
    expect(split.netBaseUnits).toBe(9_900_000n);
  });

  it("never loses or creates value: net + fee always equals gross", () => {
    for (const gross of [1n, 7n, 99n, 12_345_678_901n, 10n ** 12n]) {
      const split = splitFee(gross, 100);
      expect(split.netBaseUnits + split.feeBaseUnits).toBe(gross);
    }
  });

  it("floors the fee so rounding never favours the treasury", () => {
    // 99 base units at 1% is 0.99 -> 0, not 1
    expect(splitFee(99n, 100).feeBaseUnits).toBe(0n);
    expect(splitFee(199n, 100).feeBaseUnits).toBe(1n);
  });

  it("charges nothing when the fee is disabled or the amount is empty", () => {
    expect(splitFee(10_000_000n, 0).feeBaseUnits).toBe(0n);
    expect(splitFee(0n, 100).feeBaseUnits).toBe(0n);
    expect(splitFee(-5n as unknown as bigint, 100).feeBaseUnits).toBe(0n);
  });
});

describe("fee rate configuration", () => {
  it("defaults to 1% when unset or nonsense", () => {
    expect(parseFeeBps(undefined)).toBe(100);
    expect(parseFeeBps("")).toBe(100);
    expect(parseFeeBps("not-a-number")).toBe(100);
    expect(parseFeeBps("-50")).toBe(100);
  });

  it("respects an explicit rate but refuses to exceed the ceiling", () => {
    expect(parseFeeBps("25")).toBe(25);
    expect(parseFeeBps("0")).toBe(0);
    expect(parseFeeBps("9999")).toBe(MAX_FEE_BPS);
  });
});

describe("round-trip economics", () => {
  it("a $10 tip yields ~$0.199 across buy and sell legs", () => {
    const buy = splitFee(10_000_000n, 100); // $10.00
    const sell = splitFee(buy.netBaseUnits, 100); // $9.90 cashed out
    const totalFee = buy.feeBaseUnits + sell.feeBaseUnits;
    expect(Number(totalFee) / 1e6).toBeCloseTo(0.199, 3);
  });

  it("1,000 such tips collect ~$199", () => {
    const perTip =
      Number(splitFee(10_000_000n, 100).feeBaseUnits) +
      Number(splitFee(9_900_000n, 100).feeBaseUnits);
    expect((perTip * 1000) / 1e6).toBeCloseTo(199, 0);
  });
});
