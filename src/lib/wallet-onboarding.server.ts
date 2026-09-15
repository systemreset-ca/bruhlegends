import { secureActionUser } from "./secure-action.server";
import { accountWalletForTelegram } from "./account-wallet.server";
import { admin } from "./db.server";

export async function walletOnboarding(
  input: { session: string; initData: string },
  generate: boolean,
) {
  const userId = await secureActionUser(input.session, input.initData);
  const wallet = await accountWalletForTelegram(userId, generate);
  if (!wallet) return { wallet: null, passwordSet: false };
  const db = await admin();
  const result = await db
    .from("bruh_secure_action_credentials")
    .select("telegram_user_id")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  if (result.error)
    throw new Error("Wallet setup status unavailable. Reopen the app with a fresh /security link.");
  return {
    wallet: { address: wallet.address, network: wallet.network },
    passwordSet: !!result.data,
  };
}
