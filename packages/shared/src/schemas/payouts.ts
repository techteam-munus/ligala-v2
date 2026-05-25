import { z } from "zod";

/** Stable error codes returned by the payouts API (mirrors billing's string codes). */
export const PAYOUT_ERROR_CODES = [
  "kyc_not_approved",
  "method_not_found",
  "amount_below_minimum",
  "insufficient_balance",
  "amount_invalid",
  "payout_not_found",
  "paymongo_not_configured",
  "paymongo_request_failed",
  "paymongo_unreachable",
] as const;

const ewalletNumber = z
  .string()
  .regex(/^09\d{9}$/, "must be a PH mobile number, e.g. 09171234567");

export const payoutMethodInput = z
  .object({
    type: z.enum(["gcash", "maya", "bank"]),
    accountNumber: z.string().min(1).max(64),
    accountHolderName: z.string().min(1).max(200),
    bankBic: z.string().min(1).max(32).optional().nullable(),
    isDefault: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.type === "bank") {
      if (!d.bankBic) {
        ctx.addIssue({ code: "custom", path: ["bankBic"], message: "bankBic is required for bank" });
      }
    } else {
      if (!ewalletNumber.safeParse(d.accountNumber).success) {
        ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "must be a PH mobile number" });
      }
    }
  });
export type PayoutMethodInput = z.infer<typeof payoutMethodInput>;

export const withdrawalInput = z.object({
  payoutMethodId: z.string().min(1).max(64),
  amountCents: z.number().int().min(1).max(1_000_000_000),
});
export type WithdrawalInput = z.infer<typeof withdrawalInput>;
