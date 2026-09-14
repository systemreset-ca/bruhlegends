import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const context = { session: z.string().min(8).max(200), initData: z.string().min(10).max(4096) };
const password = z.string().min(15).max(128);

export const enrollSecureActionFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ ...context, password, confirmation: password })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { enrollSecureAction } = await import("./secure-action.server");
    return enrollSecureAction(data);
  });

export const executeAccountTipFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ ...context, intentId: z.string().uuid(), password })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { secureActionUser, authorizeAccountTip } = await import("./secure-action.server");
    const { executeAuthorizedAccountTip } = await import("./account-tip-execution.server");
    const user = await secureActionUser(data.session, data.initData);
    const grant = await authorizeAccountTip(user, data.intentId, data.password);
    return executeAuthorizedAccountTip(data.intentId, user, grant);
  });

export const readAccountTipFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ ...context, intentId: z.string().uuid() })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { secureActionUser } = await import("./secure-action.server");
    const { admin } = await import("./db.server");
    const user = await secureActionUser(data.session, data.initData);
    const db = await admin();
    const result = await db.rpc("bruh_account_tip_read", { p_id: data.intentId, p_user_id: user });
    const record = result.data as Record<string, unknown> | null;
    if (
      result.error ||
      !record ||
      record["id"] !== data.intentId ||
      String(record["sender_user_id"]) !== String(user) ||
      record["network"] !== "devnet"
    )
      throw new Error("Tip unavailable.");
    return {
      id: String(record["id"]),
      state: String(record["state"]),
      network: "devnet",
      recipient: String(record["recipient_address"]),
      lamports: String(record["lamports"]),
      feeLamports: String(record["fee_lamports"]),
      reference: String(record["reference"]),
      signature: typeof record["signature"] === "string" ? record["signature"] : null,
    };
  });

export const reconcileAccountTipFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ ...context, intentId: z.string().uuid() })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { secureActionUser } = await import("./secure-action.server");
    const { reconcileAccountTip } = await import("./account-tip-settlement.server");
    return reconcileAccountTip(data.intentId, await secureActionUser(data.session, data.initData));
  });
