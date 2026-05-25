import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const emailStatus = pgEnum("email_status", ["queued", "sent", "failed", "suppressed"]);

export const emailKind = pgEnum("email_kind", [
  "auth_verify",
  "auth_reset",
  "invoice_sent",
  "payment_receipt",
  "case_status",
  "subscription_receipt",
]);

export const emailLog = pgTable(
  "email_log",
  {
    id: text("id").primaryKey(),
    kind: emailKind("kind").notNull(),
    recipient: text("recipient").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    status: emailStatus("status").default("queued").notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => ({
    dedupeKeyUnique: uniqueIndex("email_log_dedupe_key_unique").on(t.dedupeKey),
  }),
);

export type EmailLog = typeof emailLog.$inferSelect;
export type NewEmailLog = typeof emailLog.$inferInsert;
