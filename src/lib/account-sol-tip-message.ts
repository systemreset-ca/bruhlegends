import bs58 from "bs58";

const SYSTEM = "11111111111111111111111111111111";
export type AccountSolTipMessageInput = {
  network: "devnet";
  sender: string;
  recipient: string;
  reference: string;
  blockhash: string;
  lamports: bigint;
};

/** Parse exact decimal SOL without floating point or silent rounding. */
export function accountTipLamports(amount: string): bigint {
  if (!/^(0|[1-9][0-9]{0,15})(\.[0-9]{1,9})?$/.test(amount)) throw new Error("Invalid SOL amount.");
  const [whole = "0", fraction = ""] = amount.split(".");
  const value = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"));
  if (value <= 0n || value > 9007199254740991n) throw new Error("Invalid SOL amount.");
  return value;
}

/** Single System transfer plus readonly reference, no additional authority/CPI. */
export function buildAccountSolTipMessage(input: AccountSolTipMessageInput): Uint8Array {
  if (
    input.network !== "devnet" ||
    typeof input.lamports !== "bigint" ||
    input.lamports <= 0n ||
    input.lamports > 9007199254740991n
  )
    throw new Error("Invalid SOL transfer.");
  const addresses = [input.sender, input.recipient, input.reference, SYSTEM];
  if (new Set(addresses).size !== 4) throw new Error("Invalid SOL transfer.");
  const keys = addresses.map((value) => bs58.decode(value));
  const blockhash = bs58.decode(input.blockhash);
  if (keys.some((key) => key.length !== 32) || blockhash.length !== 32)
    throw new Error("Invalid SOL transfer.");
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true);
  view.setBigUint64(4, input.lamports, true);
  const chunks = [
    new Uint8Array([1, 0, 2, 4]),
    ...keys,
    blockhash,
    new Uint8Array([1, 3, 3, 0, 1, 2, 12]),
    data,
  ];
  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function accountMessageBase64(message: Uint8Array): string {
  return btoa(Array.from(message, (byte) => String.fromCharCode(byte)).join(""));
}
