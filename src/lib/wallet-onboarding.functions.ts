import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const context = z
  .object({ session: z.string().min(8).max(200), initData: z.string().min(10).max(4096) })
  .strict();
export const readWalletOnboardingFn = createServerFn({ method: "POST" })
  .inputValidator((input) => context.parse(input))
  .handler(async ({ data }) => {
    const { walletOnboarding } = await import("./wallet-onboarding.server");
    return walletOnboarding(data, false);
  });
export const generateWalletOnboardingFn = createServerFn({ method: "POST" })
  .inputValidator((input) => context.parse(input))
  .handler(async ({ data }) => {
    const { walletOnboarding } = await import("./wallet-onboarding.server");
    return walletOnboarding(data, true);
  });
