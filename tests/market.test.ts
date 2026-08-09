import { describe, expect, it } from "vitest";
import { pricesAgree, PRICE_DISAGREEMENT_TOLERANCE } from "../src/lib/market.server";
import { milestonesFor } from "../src/lib/calls.server";

describe("provider cross-check", () => {
  it("accepts prices within tolerance", () => {
    expect(pricesAgree(1, 1)).toBe(true);
    expect(pricesAgree(1, 1 + PRICE_DISAGREEMENT_TOLERANCE)).toBe(true);
  });

  it("rejects a feed that is an order of magnitude off", () => {
    expect(pricesAgree(1, 10)).toBe(false);
    expect(pricesAgree(0.0001, 0.001)).toBe(false);
  });

  it("never treats a missing or zero price as agreement", () => {
    expect(pricesAgree(null, 1)).toBe(false);
    expect(pricesAgree(1, null)).toBe(false);
    expect(pricesAgree(0, 0)).toBe(false);
  });
});

describe("milestone selection", () => {
  it("returns every milestone the multiple has passed, once each", () => {
    expect(milestonesFor(1.9)).toEqual([]);
    expect(milestonesFor(5)).toEqual([2, 5]);
    expect(new Set(milestonesFor(11)).size).toBe(milestonesFor(11).length);
  });

  it("ignores nonsense multiples from a bad baseline", () => {
    expect(milestonesFor(0)).toEqual([]);
    expect(milestonesFor(Number.NaN)).toEqual([]);
    expect(milestonesFor(-3)).toEqual([]);
  });
});
