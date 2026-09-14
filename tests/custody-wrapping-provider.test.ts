import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { loadIsolatedDevnetVault } from "../services/custody-signer/wrapping-provider";
const identity = {
  walletId: "00000000-0000-4000-8000-000000000001",
  groupId: "00000000-0000-4000-8000-000000000002",
  membershipId: "00000000-0000-4000-8000-000000000003",
  network: "devnet" as const,
};
describe("explicit persistent isolated wrapping provider", () => {
  it("opens the same envelope after fresh factory construction with the same persistent key", async () => {
    const retained = randomBytes(32),
      copies: Uint8Array<ArrayBuffer>[] = [];
    const readWrappingKey = async () => {
      const copy = new Uint8Array(retained);
      copies.push(copy);
      return copy;
    };
    try {
      const first = await loadIsolatedDevnetVault({
        enabled: true,
        version: "fixture-v1",
        readWrappingKey,
      });
      const envelope = await first!.provision(identity);
      const restarted = await loadIsolatedDevnetVault({
        enabled: true,
        version: "fixture-v1",
        readWrappingKey,
      });
      await expect(restarted!.validate(envelope, identity)).resolves.toBeUndefined();
      expect(copies.every((copy) => copy.every((b) => b === 0))).toBe(true);
    } finally {
      retained.fill(0);
    }
  });
  it("does not consult the provider when disabled or version/config is missing", async () => {
    const readWrappingKey = vi.fn(async () => new Uint8Array(randomBytes(32)));
    for (const change of [
      { enabled: false },
      { version: undefined },
      { version: "invalid version" },
      { readWrappingKey: null },
    ])
      expect(
        await loadIsolatedDevnetVault({
          enabled: true,
          version: "fixture-v1",
          readWrappingKey,
          ...change,
        }),
      ).toBeNull();
    expect(readWrappingKey).not.toHaveBeenCalled();
  });
  it("refuses wrong-length, absent and zero keys instead of padding or generating", async () => {
    for (const material of [null, new Uint8Array(31), new Uint8Array(33), new Uint8Array(32)]) {
      expect(
        await loadIsolatedDevnetVault({
          enabled: true,
          version: "fixture-v1",
          readWrappingKey: async () => material,
        }),
      ).toBeNull();
      expect(material === null || material.every((b) => b === 0)).toBe(true);
    }
  });
  it("cannot reopen an envelope using a different explicit key/version", async () => {
    const make = (version: string) =>
      loadIsolatedDevnetVault({
        enabled: true,
        version,
        readWrappingKey: async () => new Uint8Array(randomBytes(32)),
      });
    const first = (await make("fixture-v1"))!,
      envelope = await first.provision(identity);
    await expect((await make("fixture-v1"))!.validate(envelope, identity)).rejects.toThrow();
    await expect((await make("fixture-v2"))!.validate(envelope, identity)).rejects.toThrow();
  });
  it("denies provider failure without reflecting secret-provider details", async () => {
    expect(
      await loadIsolatedDevnetVault({
        enabled: true,
        version: "fixture-v1",
        readWrappingKey: async () => {
          throw new Error("fixture sensitive diagnostic");
        },
      }),
    ).toBeNull();
  });
});
