import { describe, expect, it } from "vitest";
import { USDC_MAINNET_MINT } from "../src/lib/bruh-config.server";
import { isAllowedRegisteredTipAsset } from "../src/lib/tips.server";

const mainnetConfig = {
  network: "mainnet-beta" as const,
  bruhMint: "",
  bruhTippingEnabled: false,
};

describe("tip asset allowlist", () => {
  it("allows only the canonical mainnet USDC mint", () => {
    const asset = {
      symbol: "USDC",
      mint: USDC_MAINNET_MINT,
      decimals: 6,
      enabled: true,
      is_tip_asset: true,
      network: "mainnet-beta" as const,
    };
    expect(isAllowedRegisteredTipAsset(asset, mainnetConfig)).toBe(true);
    expect(isAllowedRegisteredTipAsset({ ...asset, mint: "lookalike" }, mainnetConfig)).toBe(false);
  });

  it("requires a network-matched, enabled devnet USDC registry row", () => {
    const devnetConfig = { ...mainnetConfig, network: "devnet" as const };
    const asset = {
      symbol: "USDC",
      mint: "devnet-usdc-mint",
      decimals: 6,
      enabled: true,
      is_tip_asset: true,
      network: "devnet" as const,
    };
    expect(isAllowedRegisteredTipAsset(asset, devnetConfig)).toBe(true);
    expect(isAllowedRegisteredTipAsset({ ...asset, network: "mainnet-beta" }, devnetConfig)).toBe(
      false,
    );
    expect(isAllowedRegisteredTipAsset({ ...asset, mint: null }, devnetConfig)).toBe(false);
  });

  it("keeps BRUH disabled until registry and environment mints match", () => {
    const asset = {
      symbol: "BRUH",
      mint: "official-bruh-mint",
      decimals: 9,
      enabled: true,
      is_tip_asset: true,
      network: "devnet" as const,
    };
    expect(
      isAllowedRegisteredTipAsset(asset, {
        network: "devnet",
        bruhMint: "official-bruh-mint",
        bruhTippingEnabled: true,
      }),
    ).toBe(true);
    expect(
      isAllowedRegisteredTipAsset(asset, {
        network: "devnet",
        bruhMint: "different-mint",
        bruhTippingEnabled: true,
      }),
    ).toBe(false);
    expect(
      isAllowedRegisteredTipAsset(asset, {
        network: "devnet",
        bruhMint: "",
        bruhTippingEnabled: false,
      }),
    ).toBe(false);
  });
});
