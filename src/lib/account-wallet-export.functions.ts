import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { secureActionPasswordError } from "./secure-action-password";

const context = { session: z.string().min(8).max(200), initData: z.string().min(10).max(4096) };
const exportId = z.string().uuid();

export const readWalletExportFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ ...context, exportId })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { authenticatedWalletExportRead } = await import("./account-wallet-export.server");
    return authenticatedWalletExportRead(data);
  });

export const revealWalletExportFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        ...context,
        exportId,
        password: z
          .string()
          .min(15)
          .max(128)
          .refine((value) => !secureActionPasswordError(value)),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { revealWalletExport } = await import("./account-wallet-export.server");
    return revealWalletExport(data);
  });
