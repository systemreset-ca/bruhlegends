import bs58 from "bs58";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const U64_MAX = (1n << 64n) - 1n;

export type AccountSolTipExpectation = {
  signature: string;
  sender: string;
  recipient: string;
  reference: string;
  lamports: bigint;
};

function encoded(value: unknown, length: number): value is string {
  try {
    return typeof value === "string" && bs58.decode(value).length === length;
  } catch {
    return false;
  }
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Match a narrowly scoped native-SOL receipt from trusted getTransaction/jsonParsed.
 * Caller must separately establish devnet and finalized commitment. This pure matcher
 * does not fetch, sign, broadcast, establish finality or consume a reference in storage.
 */
export function matchAccountSolTipReceipt(
  receipt: unknown,
  expected: AccountSolTipExpectation,
): { matched: boolean; slot?: number } {
  const denied = { matched: false };
  if (
    !encoded(expected.signature, 64) ||
    ![expected.sender, expected.recipient, expected.reference].every((key) => encoded(key, 32)) ||
    new Set([expected.sender, expected.recipient, expected.reference, SYSTEM_PROGRAM]).size !== 4 ||
    typeof expected.lamports !== "bigint" ||
    expected.lamports <= 0n ||
    expected.lamports > U64_MAX
  )
    return denied;

  const root = object(receipt);
  const meta = object(root?.["meta"]);
  const transaction = object(root?.["transaction"]);
  const message = object(transaction?.["message"]);
  if (!root || !integer(root["slot"]) || !meta || meta["err"] !== null || !message) return denied;
  if (
    !Array.isArray(transaction?.["signatures"]) ||
    transaction["signatures"].length !== 1 ||
    transaction["signatures"][0] !== expected.signature
  )
    return denied;

  const keys = message["accountKeys"];
  const instructions = message["instructions"];
  if (
    !Array.isArray(keys) ||
    keys.length !== 4 ||
    !Array.isArray(instructions) ||
    instructions.length !== 1
  )
    return denied;
  const accounts = Array.from(keys, object);
  if (accounts.some((key) => !key || !encoded(key["pubkey"], 32))) return denied;
  const pubkeys = accounts.map((key) => key!["pubkey"]);
  if (new Set(pubkeys).size !== 4 || pubkeys[0] !== expected.sender) return denied;
  for (const key of accounts) {
    const sender = key!["pubkey"] === expected.sender;
    const recipient = key!["pubkey"] === expected.recipient;
    if (key!["signer"] !== sender || key!["writable"] !== (sender || recipient)) return denied;
  }
  if (
    ![expected.recipient, expected.reference, SYSTEM_PROGRAM].every((key) => pubkeys.includes(key))
  )
    return denied;

  const instruction = object(instructions[0]);
  const parsed = object(instruction?.["parsed"]);
  const info = object(parsed?.["info"]);
  if (
    instruction?.["programId"] !== SYSTEM_PROGRAM ||
    instruction["program"] !== "system" ||
    parsed?.["type"] !== "transfer" ||
    !info ||
    info["source"] !== expected.sender ||
    info["destination"] !== expected.recipient ||
    !integer(info["lamports"]) ||
    BigInt(info["lamports"]) !== expected.lamports
  )
    return denied;

  // This deliberately permits only one direct transfer, no CPI or additional authority.
  if (
    meta["innerInstructions"] !== undefined &&
    (!Array.isArray(meta["innerInstructions"]) || meta["innerInstructions"].length !== 0)
  )
    return denied;
  if (
    ["preTokenBalances", "postTokenBalances"].some(
      (field) =>
        meta[field] !== undefined &&
        (!Array.isArray(meta[field]) || (meta[field] as unknown[]).length !== 0),
    )
  )
    return denied;
  if (
    !integer(meta["fee"]) ||
    !Array.isArray(meta["preBalances"]) ||
    !Array.isArray(meta["postBalances"]) ||
    meta["preBalances"].length !== 4 ||
    meta["postBalances"].length !== 4 ||
    !meta["preBalances"].every(integer) ||
    !meta["postBalances"].every(integer)
  )
    return denied;
  for (let index = 0; index < pubkeys.length; index++) {
    const after = meta["postBalances"][index];
    const before = meta["preBalances"][index];
    if (!integer(after) || !integer(before)) return denied;
    const delta = BigInt(after) - BigInt(before);
    const wanted =
      pubkeys[index] === expected.sender
        ? -(expected.lamports + BigInt(meta["fee"]))
        : pubkeys[index] === expected.recipient
          ? expected.lamports
          : 0n;
    if (delta !== wanted) return denied;
  }
  return { matched: true, slot: root["slot"] };
}
