import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const exchangeLoginTokenFn = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { exchangeLoginToken } = await import("./session.server");
    const session = await exchangeLoginToken(data.token);
    return { session };
  });

export const getMeFn = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ session: z.string().min(8).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { loadProfile } = await import("./miniapp.server");
    return loadProfile(data.session);
  });

export const startWalletLinkFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        session: z.string().min(8).max(200),
        membershipId: z.string().uuid(),
        address: z.string().min(32).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { startWalletLink } = await import("./miniapp.server");
    return startWalletLink(data);
  });

export const finishWalletLinkFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        session: z.string().min(8).max(200),
        membershipId: z.string().uuid(),
        challengeId: z.string().uuid(),
        signature: z.string().min(64).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { finishWalletLink } = await import("./miniapp.server");
    return finishWalletLink(data);
  });

export const unlinkWalletFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ session: z.string().min(8).max(200), membershipId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { unlinkWallet } = await import("./miniapp.server");
    return unlinkWallet(data);
  });

export const getGroupBoardFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ session: z.string().min(8).max(200), membershipId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { loadGroupBoard } = await import("./miniapp.server");
    return loadGroupBoard(data);
  });
