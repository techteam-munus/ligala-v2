import {
  bigint,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { cases, engagements } from "./cases";

/**
 * Money is stored as integer cents to avoid float drift across
 * JS/Postgres/JSON boundaries. Discount values use the same convention:
 * `percent` codes store the rate as basis points (1% = 100 bps);
 * `fixed` codes store an absolute amount in cents.
 *
 * Single-currency at launch (PHP). When we add USD/etc, every money
 * column gets a paired `currency` and we drop the column default.
 */
export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "void",
]);

export const invoices = pgTable("invoice", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  caseId: text("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "restrict" }),
  engagementId: text("engagement_id").references(() => engagements.id, {
    onDelete: "set null",
  }),
  clientId: text("client_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  lawyerId: text("lawyer_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  status: invoiceStatus("status").default("draft").notNull(),
  currency: text("currency").default("PHP").notNull(),
  subtotalCents: integer("subtotal_cents").default(0).notNull(),
  discountCents: integer("discount_cents").default(0).notNull(),
  totalCents: integer("total_cents").default(0).notNull(),
  paidCents: integer("paid_cents").default(0).notNull(),
  appliedDiscountCodeId: text("applied_discount_code_id").references(
    () => discountCodes.id,
    { onDelete: "set null" },
  ),
  notesMd: text("notes_md"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: text("void_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * One row per billable item. `qtyThousandths` lets hourly bills express
 * 0.001-hour increments (more than enough; nobody bills in microseconds).
 * `lineTotalCents` is computed by the API at write time so the invoice
 * total stays consistent if a line is later edited in a draft.
 */
export const invoiceLines = pgTable("invoice_line", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  qtyThousandths: integer("qty_thousandths").default(1000).notNull(),
  unitAmountCents: integer("unit_amount_cents").notNull(),
  lineTotalCents: integer("line_total_cents").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

/**
 * Discount codes are owned by a lawyer — same code text can be used by
 * different lawyers without collision. Validation matches by (code, lawyerId).
 *
 *   percent  -> valueBps  (e.g. 1500 = 15%)
 *   fixed    -> valueCents
 */
export const discountKind = pgEnum("discount_kind", ["percent", "fixed"]);

export const discountCodes = pgTable(
  "discount_code",
  {
    id: text("id").primaryKey(),
    lawyerId: text("lawyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    kind: discountKind("kind").notNull(),
    valueBps: integer("value_bps"),
    valueCents: integer("value_cents"),
    minSubtotalCents: integer("min_subtotal_cents"),
    maxRedemptions: integer("max_redemptions"),
    redemptions: integer("redemptions").default(0).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    perLawyerUnique: uniqueIndex("discount_code_lawyer_code_unique").on(
      t.lawyerId,
      t.code,
    ),
  }),
);

/**
 * One row per payment attempt. `providerPaymentId` is the external id used
 * for idempotency: webhooks reuse it to avoid double-applying. `rawPayload`
 * keeps the inbound webhook body for debugging.
 */
export const paymentProvider = pgEnum("payment_provider", [
  "paymongo",
  "paypal",
  "dev_simulate",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const payments = pgTable(
  "payment",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    provider: paymentProvider("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    status: paymentStatus("status").default("pending").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /**
     * Cumulative refunded amount in cents. Bumped by /admin/invoices/:id/refund.
     * Partial refunds are supported: refundedCents <= amountCents. When fully
     * refunded, the payment.status flips to `refunded`.
     */
    refundedCents: integer("refunded_cents").default(0).notNull(),
    currency: text("currency").default("PHP").notNull(),
    succeededAt: timestamp("succeeded_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    providerPaymentUnique: uniqueIndex("payment_provider_payment_id_unique").on(
      t.provider,
      t.providerPaymentId,
    ),
  }),
);

/**
 * Append-only ledger. Every money movement (charge, refund, fee, manual
 * adjustment) lands here so we can reconcile against provider statements
 * without parsing webhook history.
 */
export const transactionKind = pgEnum("transaction_kind", [
  "charge",
  "refund",
  "fee",
  "adjustment",
]);

export const transactionDirection = pgEnum("transaction_direction", [
  "credit",
  "debit",
]);

export const transactions = pgTable("transaction", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").references(() => invoices.id, {
    onDelete: "set null",
  }),
  paymentId: text("payment_id").references(() => payments.id, {
    onDelete: "set null",
  }),
  kind: transactionKind("kind").notNull(),
  direction: transactionDirection("direction").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  currency: text("currency").default("PHP").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type DiscountCode = typeof discountCodes.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
