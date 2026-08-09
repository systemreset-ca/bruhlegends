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
      .object({
        session: z.string().min(8).max(200),
        membershipId: z.string().uuid(),
        seasonId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { loadGroupBoard } = await import("./miniapp.server");
    return loadGroupBoard(data);
  });

export const getTipsFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ session: z.string().min(8).max(200), membershipId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { loadTips } = await import("./miniapp.server");
    return loadTips(data);
  });

export const verifyTipFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        session: z.string().min(8).max(200),
        membershipId: z.string().uuid(),
        tipId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { verifyTip } = await import("./miniapp.server");
    return verifyTip(data);
  });

export const getModerationFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ session: z.string().min(8).max(200), membershipId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { loadModeration } = await import("./miniapp.server");
    return loadModeration(data);
  });

export const settleDisputeFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        session: z.string().min(8).max(200),
        membershipId: z.string().uuid(),
        disputeId: z.string().uuid(),
        outcome: z.enum(["uphold", "reject"]),
        note: z.string().max(400).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { settleDispute } = await import("./miniapp.server");
    return settleDispute(data);
  });

export const saveSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        session: z.string().min(8).max(200),
        membershipId: z.string().uuid(),
        patch: z.object({
          detection_mode: z.enum(["command_only", "full_detection"]).optional(),
          min_liquidity_usd: z.number().min(0).max(10_000_000).optional(),
          min_token_age_minutes: z.number().int().min(0).max(10_080).optional(),
          allow_repeat_calls: z.boolean().optional(),
          announce_tips: z.boolean().optional(),
          announcement_mode: z.enum(["immediate", "hourly", "daily", "off"]).optional(),
          quiet_hours_start: z.number().int().min(0).max(23).nullable().optional(),
          quiet_hours_end: z.number().int().min(0).max(23).nullable().optional(),
          raw_message_retention_days: z.number().int().min(1).max(365).optional(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { saveSettings } = await import("./miniapp.server");
    return saveSettings(data);
  });
