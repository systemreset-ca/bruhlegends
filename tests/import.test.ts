import { describe, expect, it } from "vitest";
import { parseCallsCsv } from "../src/lib/import.server";
import { windowCutoff, MIN_SAMPLE } from "../src/lib/scoring.server";

const MINT = "So11111111111111111111111111111111111111112";

describe("historical call import", () => {
  it("rejects a file without the required columns", () => {
    const result = parseCallsCsv("mint,symbol\nabc,BRUH");
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]?.reason).toContain("missing_columns");
  });

  it("parses valid rows regardless of column order", () => {
    const csv = [
      "caller_telegram_id,baseline_price_usd,mint,symbol,note",
      `42,0.5,${MINT},BRUH,"early, conviction"`,
    ].join("\n");
    const result = parseCallsCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({
      mint: MINT,
      symbol: "BRUH",
      callerTelegramId: 42,
      baselinePriceUsd: 0.5,
      note: "early, conviction",
    });
  });

  it("reports bad rows by line instead of dropping them silently", () => {
    const csv = [
      "mint,caller_telegram_id,baseline_price_usd",
      "not-a-mint,42,1",
      `${MINT},0,1`,
      `${MINT},42,0`,
      `${MINT},42,1`,
    ].join("\n");
    const result = parseCallsCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });
});

describe("leaderboard windows", () => {
  it("has no cutoff for all time and a rolling cutoff otherwise", () => {
    const now = new Date("2026-02-01T00:00:00.000Z");
    expect(windowCutoff("all", now)).toBeNull();
    expect(windowCutoff("7d", now)).toBe("2026-01-25T00:00:00.000Z");
    expect(windowCutoff("30d", now)).toBe("2026-01-02T00:00:00.000Z");
  });

  it("keeps a meaningful minimum sample", () => {
    expect(MIN_SAMPLE).toBeGreaterThan(1);
  });
});
