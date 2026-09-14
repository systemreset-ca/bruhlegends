import { webcrypto } from "node:crypto";
import { DevnetCustodyVault } from "../../src/lib/custody-vault.server";

/** Isolated backend only. The owning secret provider supplies an exclusive
 * mutable 32-byte copy of a persistent, explicitly versioned random key. This
 * factory consumes/clears that copy; it never generates a replacement or stores
 * key material, and must never be configured in BRUH's application backend. */
export async function loadIsolatedDevnetVault(input: {
  enabled: boolean;
  version: string | undefined;
  readWrappingKey:
    ((version: string) => Promise<Uint8Array<ArrayBuffer> | null>) | null | undefined;
}): Promise<DevnetCustodyVault | null> {
  if (
    input.enabled !== true ||
    !input.version ||
    !/^[A-Za-z0-9._-]{1,64}$/.test(input.version) ||
    typeof input.readWrappingKey !== "function"
  )
    return null;
  let material: Uint8Array<ArrayBuffer> | null = null;
  try {
    material = await input.readWrappingKey(input.version);
    if (
      !(material instanceof Uint8Array) ||
      material.length !== 32 ||
      material.every((b) => b === 0)
    )
      return null;
    const key = await webcrypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
    return new DevnetCustodyVault(key as CryptoKey, input.version);
  } catch {
    // Secret-provider failures are opaque. Never echo their cause or use an
    // emergency/demo/padded/truncated or boot-generated key.
    return null;
  } finally {
    if (material instanceof Uint8Array) material.fill(0);
  }
}
