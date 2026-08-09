import { describe, expect, it } from "vitest";
import { bruhScore } from "../src/lib/scoring.server";
import { extractCandidateMints } from "../src/lib/calls.server";
import { toBaseUnits } from "../src/lib/tips.server";

describe("BRUH score", () => {
  it("is zero without calls", () => {
    expect(bruhScore({ calls: 0, multiples: [], milestones: 0, tipsReceived: 0 })).toBe(0);
  });

  it("damps a single lucky call below a consistent record", () => {
    const lucky = bruhScore({ calls: 1, multiples: [100], milestones: 5, tipsReceived: 0 });
    const steady = bruhScore({
      calls: 12,
      multiples: [3, 4, 2, 5, 2, 6, 3, 2, 4, 3, 2, 8],
      milestones: 14,
      tipsReceived: 0,
    });
    expect(steady).toBeGreaterThan(lucky);
  });

  it("rewards peer recognition without letting it dominate", () => {
    const base = { calls: 5, multiples: [2, 3, 1, 2, 4], milestones: 3 };
    const tipped = bruhScore({ ...base, tipsReceived: 20 });
    const untipped = bruhScore({ ...base, tipsReceived: 0 });
    expect(tipped).toBeGreaterThan(untipped);
    expect(tipped - untipped).toBeLessThan(untipped);
  });
});

describe("mint extraction", () => {
  it("finds a base58 mint inside ordinary chat", () => {
    const mint = "So11111111111111111111111111111111111111112";
    expect(extractCandidateMints(`aping ${mint} now`)).toContain(mint);
  });

  it("ignores ordinary words and short strings", () => {
    expect(extractCandidateMints("gm everyone, wagmi")).toHaveLength(0);
  });
});

describe("base unit conversion", () => {
  it("converts whole and fractional amounts exactly", () => {
    expect(toBaseUnits(1, 9)).toBe(1_000_000_000n);
    expect(toBaseUnits(0.25, 6)).toBe(250_000n);
  });

  it("does not round fractions up into extra value", () => {
    expect(toBaseUnits(0.0000004, 6)).toBe(0n);
  });
});
