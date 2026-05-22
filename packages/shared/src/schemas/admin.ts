import { z } from "zod";
import { discountCodeInput } from "./billing";

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
 * Force-verify a lawyer with no real KYC submission. Testing-only escape hatch;
 * the API enforces NODE_ENV !== "production". Reason is required so the
 * admin_audit_log entry is searchable later.
 */
export const forceVerifyLawyerInput = z.object({
  reason: z.string().min(3).max(2000),
});
export type ForceVerifyLawyerInput = z.infer<typeof forceVerifyLawyerInput>;

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

/**
 * Add a new IBP lawyer to the admin-managed directory. `rollNumber` is the
 * Supreme Court roll number and is unique. Reason is required so the
 * admin_audit_log row is searchable.
 */
export const ibpLawyerCreateInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1).max(100),
  address: z.string().trim().min(3).max(500),
  rollSigned: z.coerce.date(),
  rollNumber: z.string().trim().min(1).max(50),
  reason: z.string().min(3).max(2000),
});
export type IbpLawyerCreateInput = z.infer<typeof ibpLawyerCreateInput>;

export const ibpLawyerListQuery = z.object({
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type IbpLawyerListQuery = z.infer<typeof ibpLawyerListQuery>;

/**
 * Create an admin-owned discount code. Admin-owned codes (rows whose owner
 * has `role='admin'`) are the only codes the subscription checkout will
 * accept (see `apps/api/src/lib/subscription-discount.ts`). Reuses the base
 * `discountCodeInput` so the percent-vs-fixed refinement stays in one place,
 * and tacks on the required `reason` for the admin audit log.
 */
export const adminDiscountCodeCreateInput = discountCodeInput.and(
  z.object({ reason: z.string().min(3).max(2000) }),
);
export type AdminDiscountCodeCreateInput = z.infer<
  typeof adminDiscountCodeCreateInput
>;
