import type { DiscountCode } from "@ligala/db/schema";

/**
 * line.lineTotal = round(unit * qtyThousandths / 1000). Integer math throughout.
 */
export function computeLineTotalCents(
  unitAmountCents: number,
  qtyThousandths: number,
): number {
  return Math.round((unitAmountCents * qtyThousandths) / 1000);
}

/**
 * Apply a discount to a subtotal. Caller is expected to have already
 * verified the code belongs to the invoice's lawyer + is within validity
 * window + redemptions cap + minSubtotal.
 *
 * Returns the discount in cents (always non-negative; capped at subtotal).
 */
export function computeDiscountCents(
  subtotalCents: number,
  code: Pick<DiscountCode, "kind" | "valueBps" | "valueCents">,
): number {
  let raw = 0;
  if (code.kind === "percent" && code.valueBps != null) {
    raw = Math.floor((subtotalCents * code.valueBps) / 10_000);
  } else if (code.kind === "fixed" && code.valueCents != null) {
    raw = code.valueCents;
  }
  return Math.max(0, Math.min(raw, subtotalCents));
}

/**
 * Short, human-readable invoice number. INV-{6 alphanum} is unique-enough
 * for MVP and trivial to read aloud. We rely on the DB unique constraint
 * for collision detection; the API retries on the rare conflict.
 */
export function newInvoiceNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "INV-";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
