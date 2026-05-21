import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import type { DiscountCode } from "@ligala/db/schema";
import { computeDiscountCents } from "./billing";

/**
 * Look up an admin-owned discount code by text. Subscription codes are
 * issued by users with `role='admin'`; we find the most recently created
 * matching row so re-seeding can override stale entries without a migration.
 */
export async function lookupAdminSubscriptionCode(
  codeText: string,
): Promise<DiscountCode | null> {
  const conn = db();
  const rows = await conn
    .select({ code: schema.discountCodes })
    .from(schema.discountCodes)
    .innerJoin(schema.user, eq(schema.user.id, schema.discountCodes.lawyerId))
    .where(
      and(
        eq(schema.user.role, "admin"),
        eq(schema.discountCodes.code, codeText.toUpperCase()),
      ),
    )
    .orderBy(desc(schema.discountCodes.createdAt))
    .limit(1);
  return rows[0]?.code ?? null;
}

export type DiscountValidationError =
  | "code_not_yet_valid"
  | "code_expired"
  | "code_exhausted"
  | "subtotal_too_low";

export type DiscountValidationResult =
  | { ok: true; discountCents: number }
  | { ok: false; error: DiscountValidationError };

/**
 * Pure validator. Mirrors the rules used by `POST /invoices/:id/discount` so
 * subscription discounts behave identically to invoice discounts. The DB
 * lookup (admin-owned codes) is a separate concern — call this with the row
 * once you've found it.
 */
export function validateDiscountCodeForSubscription(
  code: DiscountCode,
  subtotalCents: number,
  now: Date,
): DiscountValidationResult {
  if (code.validFrom && code.validFrom > now) {
    return { ok: false, error: "code_not_yet_valid" };
  }
  if (code.validUntil && code.validUntil < now) {
    return { ok: false, error: "code_expired" };
  }
  if (code.maxRedemptions != null && code.redemptions >= code.maxRedemptions) {
    return { ok: false, error: "code_exhausted" };
  }
  if (code.minSubtotalCents != null && subtotalCents < code.minSubtotalCents) {
    return { ok: false, error: "subtotal_too_low" };
  }
  return { ok: true, discountCents: computeDiscountCents(subtotalCents, code) };
}
