import { ed25519 } from "@noble/curves/ed25519.js";
import bs58 from "bs58";
import {
  buildAccountSolTipMessage,
  accountMessageBase64,
  type AccountSolTipMessageInput,
} from "./account-sol-tip-message";

export type AccountWalletEnvelope = {
  id: string;
  telegramUserId: string;
  network: "devnet";
  address: string;
  keyVersion: string;
  ivHex: string;
  ciphertextHex: string;
};

function scope(record: AccountWalletEnvelope): Uint8Array {
  if (
    !/^[1-9][0-9]{0,15}$/.test(record.telegramUserId) ||
    BigInt(record.telegramUserId) > 4503599627370495n ||
    record.network !== "devnet" ||
    !/^[0-9a-f-]{36}$/.test(record.id) ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(record.keyVersion) ||
    bs58.decode(record.address).length !== 32
  )
    throw new Error("Invalid wallet scope.");
  return new TextEncoder().encode(
    JSON.stringify([
      "bruh-account-wallet-v1",
      record.id,
      record.telegramUserId,
      record.network,
      record.address,
      record.keyVersion,
    ]),
  );
}

function hex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function bytes(value: string, length: number): Uint8Array {
  if (!new RegExp(`^[0-9a-f]{${length * 2}}$`).test(value)) throw new Error("Invalid envelope.");
  return Uint8Array.from(value.match(/../g)!, (part) => parseInt(part, 16));
}

/** Persistent key must be supplied by the server secret store; never generated on boot. */
export async function importAccountWrappingKey(secret: string): Promise<CryptoKey> {
  // Lovable's secure generator supplies 32 random ASCII alphanumeric bytes.
  // Accept that exact format or an explicitly supplied 32-byte lowercase hex key.
  // No trimming, padding, truncation or fallback to a weaker/default key.
  const raw = /^[A-Za-z0-9]{32}$/.test(secret)
    ? new TextEncoder().encode(secret)
    : bytes(secret, 32);
  try {
    if (raw.every((byte) => byte === 0)) throw new Error("Invalid wrapping key.");
    return await crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
  } finally {
    raw.fill(0);
  }
}

export async function generateAccountWallet(
  telegramUserId: string,
  keyVersion: string,
  key: CryptoKey,
): Promise<AccountWalletEnvelope> {
  if (key.extractable || key.algorithm.name !== "AES-GCM") throw new Error("Invalid wrapping key.");
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  try {
    const record: AccountWalletEnvelope = {
      id: crypto.randomUUID(),
      telegramUserId,
      network: "devnet",
      address: bs58.encode(ed25519.getPublicKey(seed)),
      keyVersion,
      ivHex: hex(iv),
      ciphertextHex: "",
    };
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
        additionalData: scope(record) as BufferSource,
        tagLength: 128,
      },
      key,
      seed as BufferSource,
    );
    return { ...record, ciphertextHex: hex(new Uint8Array(ciphertext)) };
  } finally {
    seed.fill(0);
  }
}

/** Authenticate stored ownership/address before displaying a deposit address. No raw-key export. */
export async function verifyAccountWallet(
  record: AccountWalletEnvelope,
  key: CryptoKey,
): Promise<void> {
  const seed = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(record.ivHex, 12) as BufferSource,
        additionalData: scope(record) as BufferSource,
        tagLength: 128,
      },
      key,
      bytes(record.ciphertextHex, 48) as BufferSource,
    ),
  );
  try {
    if (seed.length !== 32 || bs58.encode(ed25519.getPublicKey(seed)) !== record.address)
      throw new Error("Invalid wallet envelope.");
  } finally {
    seed.fill(0);
  }
}

/** Internal constrained signer. No arbitrary message signing or raw-key export. */
export async function signAccountWalletSolTip(
  record: AccountWalletEnvelope,
  key: CryptoKey,
  input: AccountSolTipMessageInput,
) {
  const snapshot = { ...record };
  if (
    key.extractable ||
    key.algorithm.name !== "AES-GCM" ||
    input.sender !== snapshot.address ||
    input.network !== snapshot.network
  )
    throw new Error("Invalid signing scope.");
  const message = buildAccountSolTipMessage({ ...input });
  const seed = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(snapshot.ivHex, 12) as BufferSource,
        additionalData: scope(snapshot) as BufferSource,
        tagLength: 128,
      },
      key,
      bytes(snapshot.ciphertextHex, 48) as BufferSource,
    ),
  );
  try {
    if (seed.length !== 32 || bs58.encode(ed25519.getPublicKey(seed)) !== snapshot.address)
      throw new Error("Invalid signing scope.");
    const signature = ed25519.sign(message, seed);
    const transaction = new Uint8Array(1 + signature.length + message.length);
    transaction[0] = 1;
    transaction.set(signature, 1);
    transaction.set(message, 65);
    return {
      signature: bs58.encode(signature),
      signedTransaction: accountMessageBase64(transaction),
    };
  } finally {
    seed.fill(0);
  }
}
