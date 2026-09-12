import { afterEach, describe, expect, it } from "vitest";
import { resolveSolanaNetwork, resolveSolanaRpcUrl } from "../src/lib/bruh-config.server";

describe("Solana network release gate", () => {
  afterEach(() => {
    delete process.env["SOLANA_NETWORK"];
    delete process.env["SOLANA_MAINNET_ENABLED"];
  });

  it("defaults to devnet", () => {
    expect(resolveSolanaNetwork({} as NodeJS.ProcessEnv)).toBe("devnet");
  });

  it("accepts an explicit devnet", () => {
    expect(resolveSolanaNetwork({ SOLANA_NETWORK: "devnet" } as NodeJS.ProcessEnv)).toBe("devnet");
  });

  it("rejects mainnet unless the release gate is explicit", () => {
    expect(() =>
      resolveSolanaNetwork({ SOLANA_NETWORK: "mainnet-beta" } as NodeJS.ProcessEnv),
    ).toThrow("SOLANA_MAINNET_ENABLED=true");
  });

  it("accepts mainnet only with the exact release value", () => {
    expect(
      resolveSolanaNetwork({
        SOLANA_NETWORK: "mainnet-beta",
        SOLANA_MAINNET_ENABLED: "true",
      } as NodeJS.ProcessEnv),
    ).toBe("mainnet-beta");
  });

  it("rejects unknown networks", () => {
    expect(() => resolveSolanaNetwork({ SOLANA_NETWORK: "testnet" } as NodeJS.ProcessEnv)).toThrow(
      "SOLANA_NETWORK must be devnet or mainnet-beta",
    );
  });

  it("uses the public endpoint only as a devnet fallback", () => {
    expect(resolveSolanaRpcUrl("devnet", {} as NodeJS.ProcessEnv)).toBe(
      "https://api.devnet.solana.com",
    );
    expect(() => resolveSolanaRpcUrl("mainnet-beta", {} as NodeJS.ProcessEnv)).toThrow(
      "Mainnet requires an explicit SOLANA_RPC_URL",
    );
  });

  it("uses the configured provider endpoint on either network", () => {
    const env = { SOLANA_RPC_URL: "https://example-rpc.invalid/key" } as NodeJS.ProcessEnv;
    expect(resolveSolanaRpcUrl("devnet", env)).toBe(env.SOLANA_RPC_URL);
    expect(resolveSolanaRpcUrl("mainnet-beta", env)).toBe(env.SOLANA_RPC_URL);
  });
});
