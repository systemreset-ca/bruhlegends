import bs58 from "bs58";
import { randomBytes } from "node:crypto";
import { getBruhConfig } from "./bruh-config.server";

type RpcResult<T> = { result?: T; error?: { code: number; message: string } };

async function rpc<T>(method: string, params: unknown[], deadline?: AbortSignal): Promise<T> {
  const { rpcUrl } = getBruhConfig();
  let response: Response;
  try {
    response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: deadline
        ? AbortSignal.any([deadline, AbortSignal.timeout(8_000)])
        : AbortSignal.timeout(8_000),
    });
  } catch {
    // Provider URLs and error messages can contain API keys. Never propagate them.
    throw new Error(`Solana RPC ${method} unavailable`);
  }
  if (!response.ok) {
    throw new Error(`Solana RPC failed [${response.status}]`);
  }
  let json: RpcResult<T>;
  try {
    json = (await response.json()) as RpcResult<T>;
  } catch {
    throw new Error("Solana RPC invalid response");
  }
  if (!json || typeof json !== "object") throw new Error("Solana RPC invalid response");
  if (json.error) {
    throw new Error("Solana RPC provider error");
  }
  if (!("result" in json)) throw new Error("Solana RPC missing result");
  return json.result as T;
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}

/** A Solana Pay reference is any 32-byte public key; it is never signed with. */
export function createReferenceKey(): string {
  return bs58.encode(randomBytes(32));
}

export function buildSolanaPayUrl(input: {
  recipient: string;
  amountDisplay: number;
  reference: string;
  splToken?: string | null;
  label?: string;
  message?: string;
}): string {
  const params = new URLSearchParams();
  params.set("amount", String(input.amountDisplay));
  params.set("reference", input.reference);
  if (input.splToken) params.set("spl-token", input.splToken);
  params.set("label", input.label ?? "BRUH");
  params.set("message", input.message ?? "BRUH tip");
  return `solana:${input.recipient}?${params.toString()}`;
}

export async function getSolBalance(address: string): Promise<number> {
  const result = await rpc<{ value: number }>("getBalance", [address]);
  return result.value / 1_000_000_000;
}

export async function getTokenBalance(owner: string, mint: string): Promise<number> {
  const result = await rpc<{
    value: {
      account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } };
    }[];
  }>("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
  return result.value.reduce(
    (total, entry) => total + (entry.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
    0,
  );
}

export type ParsedTransaction = {
  slot: number;
  meta: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: { owner?: string; mint: string; uiTokenAmount: { amount: string } }[];
    postTokenBalances?: { owner?: string; mint: string; uiTokenAmount: { amount: string } }[];
  } | null;
  transaction: { message: { accountKeys: { pubkey: string }[] } };
};

export type TransferVerification = {
  verified: boolean;
  reason?: string;
  signature?: string;
  slot?: number;
  raw?: unknown;
};

/**
 * Pure: how much the expected recipient gained in the expected asset. Returns
 * null when the recipient never appears, so a transaction that paid someone
 * else — or moved a different mint — can never be read as a match.
 */
export function recipientDelta(
  tx: ParsedTransaction,
  recipient: string,
  mint: string | null,
): bigint | null {
  if (!tx.meta) return null;

  if (mint) {
    const matches = (balance: { owner?: string; mint: string }) =>
      balance.owner === recipient && balance.mint === mint;
    const before = tx.meta.preTokenBalances?.filter(matches) ?? [];
    const after = tx.meta.postTokenBalances?.filter(matches) ?? [];
    if (before.length === 0 && after.length === 0) return null;
    const sum = (balances: typeof before) =>
      balances.reduce((total, balance) => total + BigInt(balance.uiTokenAmount.amount), 0n);
    return sum(after) - sum(before);
  }

  const index = tx.transaction.message.accountKeys.findIndex((key) => key.pubkey === recipient);
  if (index < 0) return null;
  const before = tx.meta.preBalances[index];
  const after = tx.meta.postBalances[index];
  // Missing or rounded JSON balances must not manufacture a matching credit.
  if (
    typeof before !== "number" ||
    typeof after !== "number" ||
    !Number.isSafeInteger(before) ||
    !Number.isSafeInteger(after)
  )
    return null;
  return BigInt(after) - BigInt(before);
}

export function transferAmountMatches(
  actual: bigint,
  expected: bigint,
  tolerance: bigint = 0n,
): boolean {
  if (actual < 0n || expected < 0n || tolerance < 0n) return false;
  const difference = actual >= expected ? actual - expected : expected - actual;
  return difference <= tolerance;
}

/**
 * Server-side verification: a tip counts only when a confirmed transaction
 * carrying the intent's reference key moved the expected mint and amount to the
 * expected recipient. Nothing the client sends can substitute for this.
 */
export async function verifyTransferByReference(input: {
  reference: string;
  recipient: string;
  mint: string | null;
  amountBaseUnits: bigint;
  /** Allowed shortfall in base units (0 = exact). */
  toleranceBaseUnits?: bigint;
}): Promise<TransferVerification> {
  if (input.amountBaseUnits <= 0n) return { verified: false, reason: "invalid_amount" };
  const deadline = AbortSignal.timeout(15_000);
  const signatures = await rpc<{ signature: string; err: unknown }[]>(
    "getSignaturesForAddress",
    [input.reference, { limit: 10, commitment: "confirmed" }],
    deadline,
  );
  if (signatures.length === 0) return { verified: false, reason: "no_transaction_found" };

  const tolerance = input.toleranceBaseUnits ?? 0n;
  let mismatch: TransferVerification | null = null;

  // Enforce the request cap locally even if the provider ignores the limit.
  for (const entry of signatures.slice(0, 10)) {
    if (entry.err) continue;
    const tx = await rpc<ParsedTransaction | null>(
      "getTransaction",
      [
        entry.signature,
        { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
      ],
      deadline,
    );
    if (!tx?.meta || tx.meta.err) continue;
    if (!tx.transaction.message.accountKeys.some((key) => key.pubkey === input.reference)) {
      mismatch = { verified: false, reason: "reference_missing", signature: entry.signature };
      continue;
    }

    const delta = recipientDelta(tx, input.recipient, input.mint);
    if (delta === null) {
      mismatch ??= {
        verified: false,
        reason: "recipient_not_credited",
        signature: entry.signature,
      };
      continue;
    }

    if (transferAmountMatches(delta, input.amountBaseUnits, tolerance)) {
      return { verified: true, signature: entry.signature, slot: tx.slot, raw: tx.meta };
    }
    mismatch = { verified: false, reason: "amount_mismatch", signature: entry.signature };
  }

  return mismatch ?? { verified: false, reason: "no_confirmed_matching_transaction" };
}
