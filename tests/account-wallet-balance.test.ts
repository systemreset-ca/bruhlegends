import { afterEach, describe, expect, it, vi } from "vitest";
import { accountWalletBalance } from "../src/lib/account-wallet-balance.server";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("read-only devnet account balance", () => {
  it("checks genesis and formats finalized lamports without floating point", async () => {
    vi.stubEnv("SOLANA_RPC_URL", "https://devnet.helius-rpc.com/");
    vi.stubEnv("BRUH_DEVNET_API_KEY", "");
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ jsonrpc: "2.0", id: 2, result: { value: 1_000_000_001 } }),
      );
    vi.stubGlobal("fetch", transport);
    await expect(accountWalletBalance("public-address")).resolves.toBe("1.000000001");
    expect(transport).toHaveBeenCalledTimes(2);
    expect(JSON.parse(transport.mock.calls[1]?.[1].body)).toMatchObject({
      method: "getBalance",
      params: ["public-address", { commitment: "finalized" }],
    });
  });
  it("refuses mainnet endpoints and wrong genesis before reading balances", async () => {
    vi.stubEnv("BRUH_DEVNET_API_KEY", "");
    vi.stubEnv("SOLANA_RPC_URL", "https://mainnet.helius-rpc.com/");
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    await expect(accountWalletBalance("address")).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
    vi.stubEnv("SOLANA_RPC_URL", "https://devnet.helius-rpc.com/");
    transport.mockResolvedValueOnce(
      Response.json({ jsonrpc: "2.0", id: 1, result: "wrong-network" }),
    );
    await expect(accountWalletBalance("address")).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
