import { z } from "zod";

export const invoiceLineInput = z.object({
  description: z.string().min(1).max(500),
  qtyThousandths: z.number().int().min(1).max(1_000_000).default(1000),
  unitAmountCents: z.number().int().min(0).max(100_000_000),
});
export type InvoiceLineInput = z.infer<typeof invoiceLineInput>;

export const invoiceCreateInput = z.object({
  caseId: z.string().min(1).max(64),
  currency: z.string().length(3).default("PHP"),
  notesMd: z.string().max(4000).optional().nullable(),
  dueAt: z.iso.datetime({ offset: true }).optional().nullable(),
  lines: z.array(invoiceLineInput).min(1).max(50),
});
export type InvoiceCreateInput = z.infer<typeof invoiceCreateInput>;

export const invoicePatch = z
  .object({
    notesMd: z.string().max(4000).optional().nullable(),
    dueAt: z.iso.datetime({ offset: true }).optional().nullable(),
    lines: z.array(invoiceLineInput).min(1).max(50).optional(),
  })
  .strict();
export type InvoicePatch = z.infer<typeof invoicePatch>;

export const invoiceVoidInput = z.object({
  reason: z.string().min(3).max(500),
});
export type InvoiceVoidInput = z.infer<typeof invoiceVoidInput>;

export const discountCodeInput = z
  .object({
    code: z
      .string()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, "uppercase letters, digits, underscore, hyphen"),
    kind: z.enum(["percent", "fixed"]),
    valueBps: z.number().int().min(1).max(10_000).optional().nullable(),
    valueCents: z.number().int().min(1).max(100_000_000).optional().nullable(),
    minSubtotalCents: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
    maxRedemptions: z.number().int().min(1).max(1_000_000).optional().nullable(),
    validFrom: z.iso.datetime({ offset: true }).optional().nullable(),
    validUntil: z.iso.datetime({ offset: true }).optional().nullable(),
  })
  .refine(
    (d) =>
      (d.kind === "percent" && d.valueBps != null && d.valueCents == null) ||
      (d.kind === "fixed" && d.valueCents != null && d.valueBps == null),
    "kind must match exactly one of valueBps / valueCents",
  );
export type DiscountCodeInput = z.infer<typeof discountCodeInput>;

export const applyDiscountInput = z.object({
  code: z.string().min(1).max(40),
});
export type ApplyDiscountInput = z.infer<typeof applyDiscountInput>;

export const checkoutInput = z.object({
  provider: z.enum(["paymongo", "paypal", "dev_simulate"]),
});
export type CheckoutInput = z.infer<typeof checkoutInput>;

export const paymentWebhookInput = z.object({
  provider: z.enum(["paymongo", "paypal", "dev_simulate"]),
  providerPaymentId: z.string().min(1).max(200),
  invoiceId: z.string().min(1).max(64),
  status: z.enum(["succeeded", "failed"]),
  amountCents: z.number().int().min(0),
  currency: z.string().length(3).default("PHP"),
  failureReason: z.string().max(500).optional(),
});
export type PaymentWebhookInput = z.infer<typeof paymentWebhookInput>;
