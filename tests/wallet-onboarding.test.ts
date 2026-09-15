import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  user: vi.fn(),
  wallet: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../src/lib/secure-action.server", () => ({ secureActionUser: m.user }));
vi.mock("../src/lib/account-wallet.server", () => ({ accountWalletForTelegram: m.wallet }));
vi.mock("../src/lib/db.server", () => ({
  admin: async () => ({ rpc: m.rpc }),
}));
import { walletOnboarding } from "../src/lib/wallet-onboarding.server";
const input = { session: "synthetic-session", initData: "signed-init-data" };
beforeEach(() => {
  vi.resetAllMocks();
  m.user.mockResolvedValue(123);
  m.wallet.mockResolvedValue({
    address: "public-address",
    network: "devnet",
    id: "private-storage-id",
  });
  m.rpc.mockResolvedValue({ data: false, error: null });
});
it("reads without creation and generates only for the server-verified user", async () => {
  expect(await walletOnboarding(input, false)).toEqual({
    wallet: { address: "public-address", network: "devnet" },
    passwordSet: false,
  });
  expect(m.wallet).toHaveBeenLastCalledWith(123, false);
  await walletOnboarding(input, true);
  expect(m.wallet).toHaveBeenLastCalledWith(123, true);
  expect(m.rpc).toHaveBeenCalledWith("bruh_secure_action_password_set", { p_user_id: 123 });
});
it("rejects expired or mismatched authentication before touching wallet storage", async () => {
  m.user.mockRejectedValueOnce(new Error("Authentication unavailable."));
  await expect(walletOnboarding(input, true)).rejects.toThrow("Authentication unavailable");
  expect(m.wallet).not.toHaveBeenCalled();
});
it("reports no wallet without reading credentials and existing enrollment without exposing credential data", async () => {
  m.wallet.mockResolvedValueOnce(null);
  expect(await walletOnboarding(input, false)).toEqual({ wallet: null, passwordSet: false });
  expect(m.rpc).not.toHaveBeenCalled();
  m.rpc.mockResolvedValueOnce({ data: true, error: null });
  expect((await walletOnboarding(input, true)).passwordSet).toBe(true);
});
it("fails closed if password status cannot be read", async () => {
  m.rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
  await expect(walletOnboarding(input, true)).rejects.toThrow("Wallet setup status unavailable");
});
