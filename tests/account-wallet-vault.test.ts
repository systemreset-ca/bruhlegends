import { describe, expect, it } from "vitest";
import {
  generateAccountWallet,
  importAccountWrappingKey,
  verifyAccountWallet,
} from "../src/lib/account-wallet-vault.server";

async function wrapping() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return importAccountWrappingKey(
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
}
describe("persistent account-wallet encryption", () => {
  it("accepts the secure generator format without padding and rejects malformed lengths", async () => {
    const random = crypto.getRandomValues(new Uint8Array(32));
    const generatedFormat = Array.from(random, (byte) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[byte % 62]).join("");
    const key = await importAccountWrappingKey(generatedFormat);
    const record = await generateAccountWallet("123", "devnet-v1", key);
    await expect(verifyAccountWallet(record, await importAccountWrappingKey(generatedFormat))).resolves.toBeUndefined();
    for (const invalid of [generatedFormat.slice(1), generatedFormat + "A", " " + generatedFormat, "!".repeat(32)]) {
      await expect(importAccountWrappingKey(invalid)).rejects.toThrow();
    }
  });
  it("generates independently owned addresses and authenticates the stored seed", async () => {
    const key = await wrapping();
    expect(key.extractable).toBe(false);
    const first = await generateAccountWallet("123", "devnet-v1", key);
    const second = await generateAccountWallet("456", "devnet-v1", key);
    expect(first.address).not.toBe(second.address);
    expect(first.ciphertextHex).toHaveLength(96);
    await expect(verifyAccountWallet(first, key)).resolves.toBeUndefined();
    await expect(verifyAccountWallet(second, key)).resolves.toBeUndefined();
  });
  it("rejects substituted owner, address, network, identity and key version", async () => {
    const key = await wrapping();
    const record = await generateAccountWallet("123", "devnet-v1", key);
    const other = await generateAccountWallet("456", "devnet-v1", key);
    for (const changed of [
      { ...record, telegramUserId: "456" },
      { ...record, address: other.address },
      { ...record, network: "mainnet" as "devnet" },
      { ...record, id: other.id },
      { ...record, keyVersion: "devnet-v2" },
    ]) {
      await expect(verifyAccountWallet(changed, key)).rejects.toThrow();
    }
  });
  it("fails closed on wrong encryption keys, corrupt envelopes and invalid identities", async () => {
    const key = await wrapping();
    const record = await generateAccountWallet("123", "v1", key);
    await expect(verifyAccountWallet(record, await wrapping())).rejects.toThrow();
    await expect(
      verifyAccountWallet({ ...record, ciphertextHex: "00".repeat(48) }, key),
    ).rejects.toThrow();
    for (const user of ["0", "01", "-1", "4503599627370496"]) {
      await expect(generateAccountWallet(user, "v1", key)).rejects.toThrow();
    }
    await expect(importAccountWrappingKey("00".repeat(32))).rejects.toThrow();
  });
});
