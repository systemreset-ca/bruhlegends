const GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

/** Two bounded, read-only requests on explicit Helius devnet. No polling. */
export async function accountWalletBalance(address: string): Promise<string> {
  const key = process.env["BRUH_DEVNET_API_KEY"]?.trim();
  const endpoint = key
    ? `https://devnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`
    : process.env["SOLANA_RPC_URL"]?.trim();
  if (!endpoint) throw new Error("Devnet balance unavailable.");
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "devnet.helius-rpc.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("Devnet balance unavailable.");
  async function read(method: string, params: unknown[], id: number): Promise<unknown> {
    try {
      const response = await globalThis.fetch(url, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      });
      if (!response.ok || !response.body) throw new Error();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 16384) throw new Error();
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const result = JSON.parse(new TextDecoder().decode(bytes));
      if (result.jsonrpc !== "2.0" || result.id !== id || result.error || !("result" in result))
        throw new Error();
      return result.result;
    } catch {
      throw new Error("Devnet balance unavailable.");
    }
  }
  if ((await read("getGenesisHash", [], 1)) !== GENESIS)
    throw new Error("Devnet balance unavailable.");
  const response = (await read("getBalance", [address, { commitment: "finalized" }], 2)) as {
    value?: unknown;
  } | null;
  if (
    !response ||
    typeof response.value !== "number" ||
    !Number.isSafeInteger(response.value) ||
    response.value < 0
  )
    throw new Error("Devnet balance unavailable.");
  const amount = BigInt(response.value);
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${amount / 1_000_000_000n}${fraction ? `.${fraction}` : ""}`;
}
