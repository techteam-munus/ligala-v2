import {
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { lawyerProfiles } from "./lawyers";

export const kycStatus = pgEnum("kyc_status", [
  "pending",
  "submitted",
  "approved",
  "rejected",
]);

export const kycDocumentKind = pgEnum("kyc_document_kind", [
  "government_id",
  "bar_certificate",
  "selfie",
  "other",
]);

export const kycMethod = pgEnum("kyc_method", ["upload", "idmeta"]);

/**
 * One submission per attempt — lawyers can resubmit if rejected. The "current"
 * submission is the newest by submittedAt for a given lawyer.
 */
export const kycSubmissions = pgTable("kyc_submission", {
  id: text("id").primaryKey(),
  lawyerId: text("lawyer_id")
    .notNull()
    .references(() => lawyerProfiles.userId, { onDelete: "cascade" }),
  status: kycStatus("status").default("pending").notNull(),
  method: kycMethod("method").default("upload").notNull(),
  idmetaApplicantId: text("idmeta_applicant_id"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by").references(() => user.id, {
    onDelete: "set null",
  }),
  rejectReason: text("reject_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const kycDocuments = pgTable("kyc_document", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id")
    .notNull()
    .references(() => kycSubmissions.id, { onDelete: "cascade" }),
  kind: kycDocumentKind("kind").notNull(),
  s3Key: text("s3_key").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type KycSubmission = typeof kycSubmissions.$inferSelect;
export type NewKycSubmission = typeof kycSubmissions.$inferInsert;
export type KycDocument = typeof kycDocuments.$inferSelect;
