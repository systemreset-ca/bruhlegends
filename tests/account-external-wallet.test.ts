import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bs58 from "bs58";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/db.server", () => ({ admin: async () => ({ rpc }) }));
import { accountExternalWallet } from "../src/lib/account-external-wallet.server";
const address = bs58.encode(new Uint8Array(32).fill(9));
beforeEach(() => {
  rpc.mockReset();
  vi.stubEnv("BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED", "true");
  vi.stubEnv("SOLANA_NETWORK", "devnet");
  rpc.mockResolvedValue({
    data: { telegramUserId: "123", address, network: "devnet", status: "unverified" },
    error: null,
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("account external public address candidates", () => {
  it("binds read and registration to authenticated account and returns only unverified public data", async () => {
    expect(await accountExternalWallet(123, address)).toMatchObject({
      address,
      status: "unverified",
    });
    expect(rpc).toHaveBeenCalledWith(
      "bruh_external_wallet_register",
      expect.objectContaining({ p_user_id: "123", p_address: address }),
    );
    await accountExternalWallet(123);
    expect(rpc).toHaveBeenLastCalledWith("bruh_external_wallet_read", { p_user_id: "123" });
  });
  it("rejects invalid identity, non-public-address lengths and mainnet before database access", async () => {
    for (const user of [0, -1, 1.5, 4503599627370496])
      await expect(accountExternalWallet(user, address)).rejects.toThrow();
    for (const input of ["invalid", bs58.encode(new Uint8Array(64)), " " + address])
      await expect(accountExternalWallet(123, input)).rejects.toThrow();
    vi.stubEnv("SOLANA_NETWORK", "mainnet");
    await expect(accountExternalWallet(123, address)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("denies substituted accounts, status escalation, replacement and storage failures", async () => {
    for (const data of [
      { telegramUserId: "456", address, network: "devnet", status: "unverified" },
      { telegramUserId: "123", address, network: "mainnet", status: "unverified" },
      { telegramUserId: "123", address, network: "devnet", status: "verified" },
      {
        telegramUserId: "123",
        address: bs58.encode(new Uint8Array(32).fill(8)),
        network: "devnet",
        status: "unverified",
      },
    ]) {
      rpc.mockResolvedValue({ data, error: null });
      await expect(accountExternalWallet(123, address)).rejects.toThrow();
    }
    rpc.mockResolvedValue({ data: null, error: { message: "synthetic-private-storage-detail" } });
    await expect(accountExternalWallet(123, address)).rejects.toThrow(
      "External address registration unavailable.",
    );
  });
});
