import bs58 from "bs58";
import { admin } from "./db.server";
import { accountWalletsEnabled } from "./account-wallet.server";

type ExternalCandidate = {
  telegramUserId: string;
  address: string;
  network: "devnet";
  status: "unverified";
};

/** Public address registration only. Never imports a key or grants withdrawal authority. */
export async function accountExternalWallet(
  userId: number,
  address?: string,
): Promise<ExternalCandidate | null> {
  if (
    !accountWalletsEnabled() ||
    process.env["SOLANA_NETWORK"] !== "devnet" ||
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    userId > 4503599627370495
  )
    throw new Error("External address registration unavailable.");
  if (address !== undefined) {
    try {
      if (bs58.decode(address).length !== 32) throw new Error();
    } catch {
      throw new Error("Invalid public address.");
    }
  }
  const db = await admin();
  const result =
    address === undefined
      ? await db.rpc("bruh_external_wallet_read", { p_user_id: String(userId) })
      : await db.rpc("bruh_external_wallet_register", {
          p_user_id: String(userId),
          p_address: address,
          p_id: crypto.randomUUID(),
        });
  if (result.error) throw new Error("External address registration unavailable.");
  if (!result.data) {
    if (address !== undefined) throw new Error("External address registration unavailable.");
    return null;
  }
  const record = result.data as ExternalCandidate;
  if (
    record.telegramUserId !== String(userId) ||
    record.network !== "devnet" ||
    record.status !== "unverified"
  )
    throw new Error("External address scope mismatch.");
  try {
    if (bs58.decode(record.address).length !== 32) throw new Error();
  } catch {
    throw new Error("Invalid stored public address.");
  }
  if (address !== undefined && address !== record.address)
    throw new Error("External address replacement unavailable.");
  return record;
}
