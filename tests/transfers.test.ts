import { describe, expect, it } from "vitest";
import {
  buildSolanaPayUrl,
  isValidSolanaAddress,
  recipientDelta,
  transferAmountMatches,
  type ParsedTransaction,
} from "../src/lib/solana.server";

const RECIPIENT = "So11111111111111111111111111111111111111112";
const OTHER = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function solTx(keys: string[], pre: number[], post: number[]): ParsedTransaction {
  return {
    slot: 1,
    meta: { err: null, preBalances: pre, postBalances: post },
    transaction: { message: { accountKeys: keys.map((pubkey) => ({ pubkey })) } },
  };
}

function splTx(owner: string, mint: string, before: string, after: string): ParsedTransaction {
  return {
    slot: 1,
    meta: {
      err: null,
      preBalances: [],
      postBalances: [],
      preTokenBalances: [{ owner, mint, uiTokenAmount: { amount: before } }],
      postTokenBalances: [{ owner, mint, uiTokenAmount: { amount: after } }],
    },
    transaction: { message: { accountKeys: [] } },
  };
}

describe("transfer verification", () => {
  it("sums the recipient's matching mint across multiple token accounts", () => {
    const tx = splTx(RECIPIENT, USDC, "20", "20");
    tx.meta!.postTokenBalances!.push({
      owner: RECIPIENT,
      mint: USDC,
      uiTokenAmount: { amount: "100" },
    });
    expect(recipientDelta(tx, RECIPIENT, USDC)).toBe(100n);
  });

  it("rejects missing and unsafe SOL balance entries", () => {
    expect(recipientDelta(solTx([RECIPIENT], [], [100]), RECIPIENT, null)).toBeNull();
    expect(
      recipientDelta(solTx([RECIPIENT], [0], [Number.MAX_SAFE_INTEGER + 1]), RECIPIENT, null),
    ).toBeNull();
  });
  it("credits the expected SOL recipient only", () => {
    const tx = solTx([OTHER, RECIPIENT], [0, 0], [0, 1_000_000_000]);
    expect(recipientDelta(tx, RECIPIENT, null)).toBe(1_000_000_000n);
    expect(recipientDelta(tx, OTHER, null)).toBe(0n);
  });

  it("returns null when the recipient is not in the transaction at all", () => {
    const tx = solTx([OTHER], [0], [1_000_000_000]);
    expect(recipientDelta(tx, RECIPIENT, null)).toBeNull();
  });

  it("matches only the expected mint", () => {
    const tx = splTx(RECIPIENT, USDC, "0", "250000");
    expect(recipientDelta(tx, RECIPIENT, USDC)).toBe(250_000n);
    expect(recipientDelta(tx, RECIPIENT, OTHER)).toBeNull();
  });

  it("reports a shortfall rather than rounding it away", () => {
    const tx = splTx(RECIPIENT, USDC, "0", "249999");
    expect(recipientDelta(tx, RECIPIENT, USDC)).toBeLessThan(250_000n);
  });

  it("requires the expected amount and rejects both shortfalls and overpayments", () => {
    expect(transferAmountMatches(250_000n, 250_000n)).toBe(true);
    expect(transferAmountMatches(249_999n, 250_000n)).toBe(false);
    expect(transferAmountMatches(250_001n, 250_000n)).toBe(false);
  });

  it("allows only an explicitly configured symmetric tolerance", () => {
    expect(transferAmountMatches(249_999n, 250_000n, 1n)).toBe(true);
    expect(transferAmountMatches(250_001n, 250_000n, 1n)).toBe(true);
    expect(transferAmountMatches(250_002n, 250_000n, 1n)).toBe(false);
  });
});

describe("address validation", () => {
  it("accepts a real base58 pubkey and rejects junk", () => {
    expect(isValidSolanaAddress(RECIPIENT)).toBe(true);
    expect(isValidSolanaAddress("not-an-address")).toBe(false);
    expect(isValidSolanaAddress("")).toBe(false);
  });
});

describe("solana pay url", () => {
  it("carries recipient, amount, reference and mint", () => {
    const url = buildSolanaPayUrl({
      recipient: RECIPIENT,
      amountDisplay: 1.5,
      reference: OTHER,
      splToken: USDC,
    });
    expect(url.startsWith(`solana:${RECIPIENT}?`)).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("amount")).toBe("1.5");
    expect(params.get("reference")).toBe(OTHER);
    expect(params.get("spl-token")).toBe(USDC);
  });
});
