import { z } from "zod";

const base = { to: z.string().email(), dedupeKey: z.string().min(1) };

export const emailMessage = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("auth_verify"), ...base, data: z.object({ code: z.string().min(4).max(10) }) }),
  z.object({ kind: z.literal("auth_reset"), ...base, data: z.object({ name: z.string(), resetUrl: z.string().url() }) }),
  z.object({
    kind: z.literal("invoice_sent"), ...base,
    data: z.object({ clientName: z.string(), lawyerName: z.string(), invoiceNumber: z.string(), amountFormatted: z.string(), currency: z.string(), invoiceUrl: z.string().url() }),
  }),
  z.object({
    kind: z.literal("payment_receipt"), ...base,
    data: z.object({ clientName: z.string(), invoiceNumber: z.string(), amountPaidFormatted: z.string(), currency: z.string(), paidAtFormatted: z.string(), invoiceUrl: z.string().url() }),
  }),
  z.object({
    kind: z.literal("case_status"), ...base,
    data: z.object({
      recipientName: z.string(), caseRef: z.string(),
      event: z.enum(["case_created", "case_accepted", "case_declined", "engagement_sent", "engagement_signed", "engagement_declined", "case_closed"]),
      actorName: z.string(), caseUrl: z.string().url(),
    }),
  }),
  z.object({
    kind: z.literal("subscription_receipt"), ...base,
    data: z.object({ lawyerName: z.string(), invoiceNumber: z.string(), amountFormatted: z.string(), currency: z.string(), periodEndFormatted: z.string(), subscriptionUrl: z.string().url() }),
  }),
]);

export type EmailMessage = z.infer<typeof emailMessage>;
export type EmailKind = EmailMessage["kind"];
