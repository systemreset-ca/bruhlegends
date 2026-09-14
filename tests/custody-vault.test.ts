import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DevnetCustodyVault, type CustodyIdentity } from "../src/lib/custody-vault.server";
const crypto = webcrypto as unknown as Crypto;
const scope: CustodyIdentity = {
  walletId: "00000000-0000-4000-8000-000000000001",
  groupId: "00000000-0000-4000-8000-000000000002",
  membershipId: "00000000-0000-4000-8000-000000000003",
  network: "devnet",
};
async function vault(version = "test-v1") {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
  return new DevnetCustodyVault(key, version);
}
describe("devnet custody encryption boundary", () => {
  it("generates independent wallets and authenticated encrypted envelopes without a raw-key API", async () => {
    const store = await vault();
    const first = await store.provision(scope);
    const second = await store.provision(scope);
    expect(first.address).not.toBe(second.address);
    expect(first.seedIv).not.toBe(second.seedIv);
    expect(first.wrappingIv).not.toBe(second.wrappingIv);
    expect(Object.keys(first).sort()).toEqual(
      [
        "address",
        "encryptedSeed",
        "groupId",
        "membershipId",
        "network",
        "seedIv",
        "version",
        "walletId",
        "wrappedDataKey",
        "wrappingIv",
        "wrappingKeyVersion",
      ].sort(),
    );
    await store.validate(first, scope);
  });
  it.each(["walletId", "groupId", "membershipId"] as const)(
    "rejects envelope substitution across %s",
    async (field) => {
      const store = await vault();
      const envelope = await store.provision(scope);
      const other = { ...scope, [field]: "00000000-0000-4000-8000-000000000009" };
      await expect(store.validate(envelope, other)).rejects.toThrow("scope mismatch");
      await expect(store.validate({ ...envelope, [field]: other[field] }, other)).rejects.toThrow(
        "authentication failed",
      );
    },
  );
  it.each(["encryptedSeed", "wrappedDataKey", "seedIv", "wrappingIv"] as const)(
    "rejects tampered %s",
    async (field) => {
      const store = await vault();
      const envelope = await store.provision(scope);
      const changed = Buffer.from(envelope[field], "base64");
      changed[0] ^= 1;
      await expect(
        store.validate({ ...envelope, [field]: changed.toString("base64") }, scope),
      ).rejects.toThrow("authentication failed");
    },
  );
  it("rotates encryption without changing the wallet and rejects the old key", async () => {
    const old = await vault();
    const next = await vault("test-v2");
    const before = await old.provision(scope);
    const after = await old.rotate(before, scope, next);
    expect(after.address).toBe(before.address);
    expect(after.encryptedSeed).not.toBe(before.encryptedSeed);
    await next.validate(after, scope);
    await expect(old.validate(after, scope)).rejects.toThrow("scope mismatch");
    await expect((await vault()).validate(before, scope)).rejects.toThrow("authentication failed");
  });
  it("refuses mainnet, malformed scope and extractable wrapping keys", async () => {
    const store = await vault();
    await expect(
      store.provision({ ...scope, network: "mainnet-beta" } as unknown as CustodyIdentity),
    ).rejects.toThrow("devnet");
    await expect(store.provision({ ...scope, membershipId: "bad" })).rejects.toThrow("identity");
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    expect(() => new DevnetCustodyVault(key, "test-v1")).toThrow("wrapping key");
  });
});
