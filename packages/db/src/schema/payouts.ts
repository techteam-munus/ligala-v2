// packages/db/src/schema/payouts.ts
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { payments } from "./billing";

/**
 * Append-only per-lawyer balance ledger. The withdrawable balance is COMPUTED
 * from these rows (no denormalized total in v1): `available` = signed sum of
 * entries whose `clears_at <= now`, `pending` = signed sum of the rest.
 *
 *   earning        credit  +gross                  clears_at = now + clearing window
 *   processing_fee debit   -PayMongo collection fee clears_at = now + clearing window (clears WITH its earning)
 *   payout         debit   -(withdrawal - fee)      clears_at = now (immediate)
 *   payout_fee     debit   -PHP 10                  clears_at = now (immediate)
 *   refund_reversal debit  -net previously credited clears_at = now (immediate; may drive available negative)
 *   adjustment     either  admin correction         clears_at = now
 */
export const balanceEntryKind = pgEnum("balance_entry_kind", [
  "earning",
  "processing_fee",
  "payout",
  "payout_fee",
  "refund_reversal",
  "adjustment",
]);

export const balanceEntryDirection = pgEnum("balance_entry_direction", [
  "credit",
  "debit",
]);

export const balanceEntries = pgTable("balance_entry", {
  id: text("id").primaryKey(),
  lawyerId: text("lawyer_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  kind: balanceEntryKind("kind").notNull(),
  direction: balanceEntryDirection("direction").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  currency: text("currency").default("PHP").notNull(),
  clearsAt: timestamp("clears_at", { withTimezone: true }).notNull(),
  relatedPaymentId: text("related_payment_id").references(() => payments.id, {
    onDelete: "set null",
  }),
  // FK added after `payouts` is declared below (self-reference ordering).
  relatedPayoutId: text("related_payout_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const payoutMethodType = pgEnum("payout_method_type", [
  "gcash",
  "maya",
  "bank",
]);

export const lawyerPayoutMethods = pgTable("lawyer_payout_method", {
  id: text("id").primaryKey(),
  lawyerId: text("lawyer_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: payoutMethodType("type").notNull(),
  // Mobile number (09XXXXXXXXX) for e-wallets; account number for bank.
  accountNumber: text("account_number").notNull(),
  accountHolderName: text("account_holder_name").notNull(),
  // PayMongo institution / BIC code — banks only.
  bankBic: text("bank_bic"),
  isDefault: boolean("is_default").default(false).notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const payoutProvider = pgEnum("payout_provider", [
  "paymongo",
  "dev_simulate",
]);

export const payoutStatus = pgEnum("payout_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "returned",
]);

export const payouts = pgTable(
  "payout",
  {
    id: text("id").primaryKey(),
    lawyerId: text("lawyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    payoutMethodId: text("payout_method_id")
      .notNull()
      .references(() => lawyerPayoutMethods.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    feeCents: integer("fee_cents").default(1000).notNull(),
    netCents: integer("net_cents").notNull(),
    currency: text("currency").default("PHP").notNull(),
    provider: payoutProvider("provider").notNull(),
    providerTransferId: text("provider_transfer_id"),
    status: payoutStatus("status").default("pending").notNull(),
    failureReason: text("failure_reason"),
    destinationSnapshot: jsonb("destination_snapshot").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => ({
    providerTransferUnique: uniqueIndex("payout_provider_transfer_id_unique").on(
      t.provider,
      t.providerTransferId,
    ),
  }),
);

export type BalanceEntry = typeof balanceEntries.$inferSelect;
export type NewBalanceEntry = typeof balanceEntries.$inferInsert;
export type LawyerPayoutMethod = typeof lawyerPayoutMethods.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;
