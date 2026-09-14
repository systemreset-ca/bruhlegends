import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { secureActionPasswordError } from "./secure-action-password";

const context = { session: z.string().min(8).max(200), initData: z.string().min(10).max(4096) };
const password = z
  .string()
  .min(15)
  .max(128)
  .refine((value) => !secureActionPasswordError(value), "Password exceeds 256 UTF-8 bytes.");

export const enrollSecureActionFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ ...context, password, confirmation: password })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { enrollSecureAction } = await import("./secure-action.server");
    try {
      await enrollSecureAction(data);
      return { enrolled: true as const, message: "Password saved." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const messages: Record<string, string> = {
        "Authentication unavailable.":
          "Your private authorization expired or could not be verified. Close this app, run /security in your private bot chat, and open the new button.",
        "Passwords do not match.": "Passwords do not match exactly.",
        "Invalid Secure Action Password.":
          "Password must be 15–128 characters and no more than 256 UTF-8 bytes. No capital, number or special character is required.",
        "Secure Action Password setup unavailable or already complete.":
          "Setup could not proceed: a password may already be set, another setup may be in progress, or the setup service is unavailable. Changing the characters will not fix this. If you already set a password, use it to authorize your tip.",
        "Account tips unavailable.":
          "Wallet authorization is currently unavailable. This is not a password-format error.",
      };
      return {
        enrolled: false as const,
        message:
          messages[message] ??
          "Password setup could not be completed because of a service error. This does not mean your password needs different characters. Please try a fresh /security link.",
      };
    }
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
