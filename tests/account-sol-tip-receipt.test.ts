import { afterEach, describe, expect, it, vi } from "vitest";
import bs58 from "bs58";
import {
  matchAccountSolTipReceipt,
  type AccountSolTipExpectation,
} from "../src/lib/account-sol-tip-receipt";
import { verifyFinalizedAccountSolTip } from "../src/lib/account-wallet-balance.server";

// Synthetic parsed-RPC fixtures, never presented as actual on-chain execution.
const address = (byte: number) => bs58.encode(new Uint8Array(32).fill(byte));
const expected: AccountSolTipExpectation = {
  signature: bs58.encode(new Uint8Array(64).fill(7)),
  sender: address(1),
  recipient: address(2),
  reference: address(3),
  lamports: 1_000_000n,
};
function receipt() {
  return {
    slot: 100,
    meta: {
      err: null,
      fee: 5000,
      preBalances: [2_000_000, 0, 1, 0],
      postBalances: [995_000, 1_000_000, 1, 0],
      innerInstructions: [],
      preTokenBalances: [],
      postTokenBalances: [],
    },
    transaction: {
      signatures: [expected.signature],
      message: {
        accountKeys: [
          { pubkey: expected.sender, signer: true, writable: true },
          { pubkey: expected.recipient, signer: false, writable: true },
          { pubkey: "11111111111111111111111111111111", signer: false, writable: false },
          { pubkey: expected.reference, signer: false, writable: false },
        ],
        instructions: [
          {
            program: "system",
            programId: "11111111111111111111111111111111",
            parsed: {
              type: "transfer",
              info: {
                source: expected.sender,
                destination: expected.recipient,
                lamports: 1_000_000,
              },
            },
          },
        ],
      },
    },
  };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("account SOL tip receipt proof", () => {
  it("matches exact sender-authorized SOL and recipient credit including sender network fee", () => {
    expect(matchAccountSolTipReceipt(receipt(), expected)).toEqual({ matched: true, slot: 100 });
  });
  it("rejects wrong identity, signature, reference and amount", () => {
    for (const changed of [
      { ...expected, sender: address(9) },
      { ...expected, recipient: address(9) },
      { ...expected, reference: address(9) },
      { ...expected, signature: bs58.encode(new Uint8Array(64).fill(8)) },
      { ...expected, lamports: 999_999n },
      { ...expected, lamports: 0n },
      { ...expected, lamports: 1n << 64n },
      { ...expected, recipient: expected.sender },
    ])
      expect(matchAccountSolTipReceipt(receipt(), changed).matched).toBe(false);
  });
  it("rejects balance-only matches with a substituted transfer or additional authority", () => {
    const substitutions = [receipt(), receipt(), receipt(), receipt(), receipt()];
    substitutions[0].transaction.message.instructions[0].parsed.info.source = address(9);
    substitutions[1].transaction.message.instructions[0].programId = address(9);
    substitutions[2].transaction.message.accountKeys[3].signer = true;
    substitutions[3].transaction.message.accountKeys[3].writable = true;
    substitutions[4].transaction.message.instructions.push(
      substitutions[4].transaction.message.instructions[0],
    );
    for (const tx of substitutions)
      expect(matchAccountSolTipReceipt(tx, expected).matched).toBe(false);
  });
  it("fails closed on execution errors, unsafe JSON values, malformed data and unexplained debits", () => {
    const failures: unknown[] = [null, {}, { ...receipt(), meta: null }];
    failures.push({
      ...receipt(),
      meta: { ...receipt().meta, err: { InstructionError: [0, "error"] } },
    });
    const unsafe = receipt();
    unsafe.meta.postBalances[1] = Number.MAX_SAFE_INTEGER + 1;
    failures.push(unsafe);
    const extraDebit = receipt();
    extraDebit.meta.postBalances[0]--;
    failures.push(extraDebit);
    const badSlot = receipt();
    badSlot.slot = -1;
    failures.push(badSlot);
    const cpi = receipt();
    failures.push({
      ...cpi,
      meta: { ...cpi.meta, innerInstructions: [{ index: 0, instructions: [] }] },
    });
    for (const tx of failures) expect(matchAccountSolTipReceipt(tx, expected).matched).toBe(false);
  });
  it("checks devnet genesis and requests one finalized transaction without polling", async () => {
    vi.stubEnv("BRUH_DEVNET_API_KEY", "");
    vi.stubEnv("SOLANA_RPC_URL", "https://devnet.helius-rpc.com/");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
        }),
      )
      .mockResolvedValueOnce(Response.json({ jsonrpc: "2.0", id: 2, result: receipt() }));
    vi.stubGlobal("fetch", fetcher);
    await expect(verifyFinalizedAccountSolTip(expected)).resolves.toEqual({
      matched: true,
      slot: 100,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({
      method: "getTransaction",
      params: [expected.signature, { encoding: "jsonParsed", commitment: "finalized" }],
    });
  });
  it("rejects wrong network before transaction lookup and malformed signatures before any RPC", async () => {
    vi.stubEnv("BRUH_DEVNET_API_KEY", "");
    vi.stubEnv("SOLANA_RPC_URL", "https://devnet.helius-rpc.com/");
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ jsonrpc: "2.0", id: 1, result: "mainnet-genesis" }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      verifyFinalizedAccountSolTip({ ...expected, signature: "invalid" }),
    ).resolves.toEqual({ matched: false });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(verifyFinalizedAccountSolTip(expected)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
