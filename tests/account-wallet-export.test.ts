import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bs58 from "bs58";

vi.mock("../src/lib/db.server", () => ({ admin: vi.fn() }));
vi.mock("../src/lib/session.server", () => ({ resolveSession: vi.fn(), verifyInitData: vi.fn() }));
import { admin } from "../src/lib/db.server";
import { resolveSession, verifyInitData } from "../src/lib/session.server";
import {
  readWalletExport,
  requestWalletExport,
  revealWalletExport,
} from "../src/lib/account-wallet-export.server";
import {
  generateAccountWallet,
  importAccountWrappingKey,
} from "../src/lib/account-wallet-vault.server";
import { secureActionHash, SECURE_ACTION_PBKDF2_ITERATIONS } from "../src/lib/secure-action.server";

const userId = 123;
const exportId = "11111111-1111-4111-8111-111111111111";
const nonce = "22222222-2222-4222-8222-222222222222";
const password = "SyntheticExportHorse!";
const salt = "01".repeat(16);
const wrappingSecret = Array.from({ length: 32 }, (_, index) =>
  (index % 16).toString(16).padStart(2, "0"),
).join("");
const rpc = vi.fn();
let envelope: Awaited<ReturnType<typeof generateAccountWallet>>;
let expectedHash: string;

beforeAll(async () => {
  envelope = await generateAccountWallet(
    String(userId),
    "devnet-v1",
    await importAccountWrappingKey(wrappingSecret),
  );
  const hash = await secureActionHash(password, salt, userId);
  expectedHash = hash.toString("hex");
  hash.fill(0);
});

beforeEach(() => {
  vi.resetAllMocks();
  for (const [name, value] of Object.entries({
    SOLANA_NETWORK: "devnet",
    BRUH_ACCOUNT_WALLETS_DEVNET_ENABLED: "true",
    BRUH_ACCOUNT_WALLET_EXPORT_DEVNET_ENABLED: "true",
    BRUH_ACCOUNT_WALLET_KEY_VERSION: "devnet-v1",
    BRUH_ACCOUNT_WALLET_WRAPPING_KEY: wrappingSecret,
  }))
    vi.stubEnv(name, value);
  vi.mocked(resolveSession).mockResolvedValue({ telegramUserId: userId, groupId: null });
  vi.mocked(verifyInitData).mockReturnValue(userId);
  vi.mocked(admin).mockResolvedValue({ rpc, from: vi.fn() });
  rpc.mockImplementation(async (name, args) => {
    if (name === "bruh_account_wallet_export_request" || name === "bruh_account_wallet_export_read")
      return {
        data: {
          id: exportId,
          telegram_user_id: userId,
          wallet_id: envelope.id,
          network: "devnet",
          address: envelope.address,
          status: "pending",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      };
    if (name === "bruh_account_wallet_export_begin")
      return {
        data: {
          allowed: true,
          nonce,
          saltHex: salt,
          hashHex: expectedHash,
          iterations: SECURE_ACTION_PBKDF2_ITERATIONS,
        },
      };
    if (name === "bruh_account_wallet_export_finish") return { data: args.p_ok };
    if (name === "bruh_account_wallet_export_consume")
      return { data: { wallet_id: envelope.id, address: envelope.address } };
    if (name === "bruh_account_wallet_read") return { data: envelope };
    throw new Error(`Unexpected RPC ${name}`);
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("protected account-wallet export", () => {
  it("requests and reads only sanitized account-bound metadata", async () => {
    await expect(requestWalletExport(userId)).resolves.toMatchObject({
      id: exportId,
      address: envelope.address,
      status: "pending",
    });
    await expect(readWalletExport(userId, exportId)).resolves.toMatchObject({ id: exportId });
  });

  it("requires the password proof, consumes one grant and reveals a valid Solana secret", async () => {
    const result = await revealWalletExport({
      session: "session-token",
      initData: "signed-init-data",
      exportId,
      password,
    });
    const decoded = bs58.decode(result.secretKey);
    expect(decoded).toHaveLength(64);
    expect(bs58.encode(decoded.slice(32))).toBe(envelope.address);
    expect(result.clearAfterSeconds).toBe(60);
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      "bruh_account_wallet_export_begin",
      "bruh_account_wallet_export_finish",
      "bruh_account_wallet_export_consume",
      "bruh_account_wallet_read",
    ]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(password);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(result.secretKey);
  });

  it("does not consume or decrypt after a wrong password", async () => {
    await expect(
      revealWalletExport({
        session: "session-token",
        initData: "signed-init-data",
        exportId,
        password: "WrongSyntheticExport!",
      }),
    ).rejects.toThrow("Authorization unavailable.");
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      "bruh_account_wallet_export_begin",
      "bruh_account_wallet_export_finish",
    ]);
  });
});
