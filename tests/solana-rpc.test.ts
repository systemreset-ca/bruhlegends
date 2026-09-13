import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/bruh-config.server", () => ({
  getBruhConfig: () => ({ rpcUrl: "https://provider.invalid/?api-key=SECRET_MARKER" }),
}));
import { getSolBalance, verifyTransferByReference } from "../src/lib/solana.server";

const input = { reference: "ref", recipient: "recipient", mint: null, amountBaseUnits: 100n };
const tx = {
  slot: 1,
  meta: { err: null, preBalances: [0, 0], postBalances: [0, 100] },
  transaction: { message: { accountKeys: [{ pubkey: "ref" }, { pubkey: "recipient" }] } },
};
const response = (result: unknown) => new Response(JSON.stringify({ result }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("bounded Solana RPC verification", () => {
  it("aborts a stalled request after eight seconds without retrying", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    });
    const fetchMock = vi.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(new Error("SECRET_MARKER")), {
            once: true,
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const assertion = expect(getSolBalance("address")).rejects.toThrow(
      "Solana RPC getBalance unavailable",
    );
    await vi.advanceTimersByTimeAsync(8_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects an otherwise matching transaction without the expected reference", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([{ signature: "sig", err: null }]))
      .mockResolvedValueOnce(
        response({
          ...tx,
          transaction: { message: { accountKeys: [{ pubkey: "other" }, { pubkey: "recipient" }] } },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTransferByReference(input)).toMatchObject({
      verified: false,
      reason: "reference_missing",
    });
  });

  it("continues past a mismatched transaction to the correct payment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response([
          { signature: "wrong", err: null },
          { signature: "right", err: null },
        ]),
      )
      .mockResolvedValueOnce(response({ ...tx, meta: { ...tx.meta, postBalances: [0, 99] } }))
      .mockResolvedValueOnce(response(tx));
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTransferByReference(input)).toMatchObject({
      verified: true,
      signature: "right",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).params[1]).toEqual({
      limit: 10,
      commitment: "confirmed",
    });
    expect(fetchMock.mock.calls.every((call) => call[1].signal instanceof AbortSignal)).toBe(true);
  });

  it("makes at most eleven requests even if the provider ignores the signature limit", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => response(null));
    fetchMock.mockResolvedValueOnce(
      response(Array.from({ length: 30 }, (_, i) => ({ signature: `sig${i}`, err: null }))),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect((await verifyTransferByReference(input)).verified).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it("makes no provider call for a nonpositive expected amount", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTransferByReference({ ...input, amountBaseUnits: 0n })).toMatchObject({
      verified: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([429, 503])(
    "does not retry HTTP %s or read its potentially sensitive body",
    async (status) => {
      const bodyRead = vi.fn();
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status, text: bodyRead });
      vi.stubGlobal("fetch", fetchMock);
      await expect(getSolBalance("address")).rejects.toThrow(`Solana RPC failed [${status}]`);
      expect(bodyRead).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("redacts provider URL and exception details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("SECRET_MARKER")));
    await expect(getSolBalance("address")).rejects.toThrow("Solana RPC getBalance unavailable");
  });

  it("does not propagate JSON-RPC error messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { code: -1, message: "SECRET_MARKER" } })),
        ),
    );
    await expect(getSolBalance("address")).rejects.toThrow("Solana RPC provider error");
  });

  it("rejects a malformed RPC envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(getSolBalance("address")).rejects.toThrow("Solana RPC missing result");
  });
});
