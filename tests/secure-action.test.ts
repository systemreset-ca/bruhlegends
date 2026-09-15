import { afterEach, beforeEach, beforeAll, expect, it, vi } from "vitest";
vi.mock("../src/lib/db.server", () => ({ admin: vi.fn() }));
vi.mock("../src/lib/session.server", () => ({ resolveSession: vi.fn(), verifyInitData: vi.fn() }));
import { admin } from "../src/lib/db.server";
import { resolveSession, verifyInitData } from "../src/lib/session.server";
import {
  authorizeAccountTip,
  enrollSecureAction,
  secureActionHash,
  secureActionUser,
} from "../src/lib/secure-action.server";
const id = "00000000-0000-4000-8000-000000000001";
const password = "SyntheticHorseBattery!";
const salt = "01".repeat(16);
const rpc = vi.fn();
let expectedHash: string;
beforeAll(async () => {
  const hash = await secureActionHash(password, salt, 123);
  expectedHash = hash.toString("hex");
  hash.fill(0);
});
beforeEach(() => {
  vi.resetAllMocks();
  for (const [name, value] of Object.entries({
    SOLANA_NETWORK: "devnet",
    BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED: "true",
    BRUH_ACCOUNT_TIPS_DEVNET_ENABLED: "true",
  }))
    vi.stubEnv(name, value);
  vi.mocked(resolveSession).mockResolvedValue({ telegramUserId: 123, groupId: null });
  vi.mocked(verifyInitData).mockReturnValue(123);
  vi.mocked(admin).mockResolvedValue({ rpc, from: vi.fn() });
  rpc.mockImplementation(async (name, args) => {
    if (name === "bruh_secure_action_setup_begin") return { data: id };
    if (name === "bruh_secure_action_enroll") return { data: true };
    if (name === "bruh_secure_action_begin")
      return {
        data: {
          allowed: true,
          nonce: id,
          saltHex: salt,
          hashHex: expectedHash,
          iterations: 600000,
        },
      };
    if (name === "bruh_secure_action_finish") return { data: args.p_ok };
    throw new Error("unexpected RPC");
  });
});
afterEach(() => vi.unstubAllEnvs());
it("requires matching resolved session and fresh server-verified initData", async () => {
  expect(await secureActionUser("session-token", "signed-init-data")).toBe(123);
  expect(verifyInitData).toHaveBeenCalledWith("signed-init-data", 300);
  vi.mocked(verifyInitData).mockReturnValue(456);
  await expect(secureActionUser("session-token", "signed-init-data")).rejects.toThrow();
  vi.mocked(verifyInitData).mockReturnValue(123);
  vi.mocked(resolveSession).mockResolvedValue(null);
  await expect(secureActionUser("session-token", "signed-init-data")).rejects.toThrow();
  expect(admin).not.toHaveBeenCalled();
});
it("derives a salted account-bound hash and uses a setup lease only for the immediate write", async () => {
  expect(
    await enrollSecureAction({
      session: "session-token",
      initData: "signed-init-data",
      password,
      confirmation: password,
    }),
  ).toEqual({ enrolled: true });
  expect(rpc.mock.calls.map((call) => call[0])).toEqual([
    "bruh_secure_action_setup_begin",
    "bruh_secure_action_enroll",
  ]);
  expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p_user_id: 123, p_nonce: id });
  expect(rpc.mock.calls[1]?.[1].p_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(rpc.mock.calls)).not.toContain(password);
  const scoped = await secureActionHash(password, salt, 456);
  expect(scoped.toString("hex")).not.toBe(expectedHash);
  scoped.fill(0);
});
it("cannot overwrite existing setup or bypass mismatched confirmation", async () => {
  await expect(
    enrollSecureAction({
      session: "session-token",
      initData: "signed-init-data",
      password,
      confirmation: "different long password",
    }),
  ).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: null });
  await expect(
    enrollSecureAction({
      session: "session-token",
      initData: "signed-init-data",
      password,
      confirmation: password,
    }),
  ).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("checks the password and returns a one-use opaque grant while storing only its hash", async () => {
  const grant = await authorizeAccountTip(123, id, password);
  expect(grant).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(rpc.mock.calls[1]?.[1]).toMatchObject({
    p_user_id: 123,
    p_intent_id: id,
    p_nonce: id,
    p_ok: true,
  });
  expect(rpc.mock.calls[1]?.[1].p_token_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(rpc.mock.calls)).not.toContain(grant);
  expect(JSON.stringify(rpc.mock.calls)).not.toContain(password);
});
it("records a failed password proof and never returns a grant on a locked attempt", async () => {
  await expect(authorizeAccountTip(123, id, "wrong synthetic long password")).rejects.toThrow();
  expect(rpc.mock.calls[1]?.[1].p_ok).toBe(false);
  rpc.mockClear().mockResolvedValue({ data: { allowed: false } });
  await expect(authorizeAccountTip(123, id, password)).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("refuses mainnet and invalid password bounds", async () => {
  vi.stubEnv("SOLANA_NETWORK", "mainnet-beta");
  await expect(authorizeAccountTip(123, id, password)).rejects.toThrow();
  expect(admin).not.toHaveBeenCalled();
  await expect(secureActionHash("short", salt, 123)).rejects.toThrow();
  await expect(secureActionHash("x".repeat(257), salt, 123)).rejects.toThrow();
});
