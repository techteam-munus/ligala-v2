import { z } from "zod";

export const userStatusEnum = z.enum(["active", "paused", "banned"]);
export type UserStatusEnum = z.infer<typeof userStatusEnum>;

/** Required reason — pauses/bans always need a justification for audit. */
export const userStatusInput = z.object({
  status: userStatusEnum,
  reason: z.string().min(3).max(2000),
});
export type UserStatusInput = z.infer<typeof userStatusInput>;

export const adminUserRoleInput = z.object({
  role: z.enum(["client", "lawyer", "admin"]),
  reason: z.string().min(3).max(2000),
});
export type AdminUserRoleInput = z.infer<typeof adminUserRoleInput>;

export const kycAdminDecisionInput = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(2000).optional(),
});
export type KycAdminDecisionInput = z.infer<typeof kycAdminDecisionInput>;

/**
 * Refund — `amountCents` is the partial amount to refund. Caller is expected
 * to verify it's <= (payment.amountCents - payment.refundedCents); the API
 * also re-checks. Reason is mandatory for the audit log.
 */
export const refundInput = z.object({
  paymentId: z.string().uuid(),
  amountCents: z.number().int().min(1),
  reason: z.string().min(3).max(2000),
});
export type RefundInput = z.infer<typeof refundInput>;

export const adminListQuery = z.object({
  q: z.string().max(200).optional(),
  role: z.enum(["client", "lawyer", "admin"]).optional(),
  status: userStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminListQuery = z.infer<typeof adminListQuery>;

export const adminInvoiceListQuery = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(["draft", "sent", "paid", "partially_paid", "void"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminInvoiceListQuery = z.infer<typeof adminInvoiceListQuery>;
