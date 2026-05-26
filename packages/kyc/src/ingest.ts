import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { extractImages } from "./extract";
import { fetchDocumentBytes, finalizeVerification } from "./idmeta";
import { mapIdmetaStatus, type KycStatus } from "./status";
import { putKycDocument } from "./s3";

export interface IngestInput {
  verificationId: string;
  /** String/numeric status from the webhook, if present. */
  status?: string | number;
  /** `verification_results` from the webhook, if present (primary image source). */
  verificationResults?: unknown;
}

export interface IngestResult {
  notFound?: boolean;
  submissionId?: string;
  status?: KycStatus;
  ingestedDocuments: number;
}

/**
 * Reconcile one IDMeta verification into our KYC tables. Idempotent: maps the
 * verification to a submission (by idmetaApplicantId, then metadata fallback),
 * skips image ingestion when the submission already has documents, and always
 * reconciles the submission status. Shared by the api webhook (inline, dev) and
 * the workers/idmeta Lambda (SQS, prod).
 */
export async function ingestIdmetaResult(input: IngestInput): Promise<IngestResult> {
  const conn = db();

  // 1. Resolve submission. Primary: the verification id we stored at /start.
  let submission = await conn.query.kycSubmissions.findFirst({
    where: eq(schema.kycSubmissions.idmetaApplicantId, input.verificationId),
  });
  // Fallback: a submission whose id equals the verification id (defensive).
  if (!submission) {
    submission = await conn.query.kycSubmissions.findFirst({
      where: eq(schema.kycSubmissions.id, input.verificationId),
    });
  }
  if (!submission) return { notFound: true, ingestedDocuments: 0 };

  // 2. Determine status. Prefer the webhook status; finalize as a backstop.
  let statusValue: string | number | undefined = input.status;
  let results: unknown = input.verificationResults;
  if (statusValue === undefined || results == null) {
    try {
      const finalized = (await finalizeVerification(input.verificationId)) as Record<string, unknown>;
      statusValue ??=
        (finalized.status_message as string | undefined) ??
        (finalized.status as string | number | undefined);
      results ??= finalized.verification_results ?? finalized;
    } catch (err) {
      console.error("[kyc] finalize backstop failed for", input.verificationId, err);
    }
  }
  const status = mapIdmetaStatus(statusValue);

  // 3. Ingest images — skip if this submission already has documents (idempotent).
  let ingestedDocuments = 0;
  const existing = await conn.query.kycDocuments.findMany({
    where: eq(schema.kycDocuments.submissionId, submission.id),
  });
  if (existing.length === 0) {
    const images = extractImages(results);
    const rows: { id: string; submissionId: string; kind: "selfie" | "government_id"; s3Key: string }[] = [];
    for (const img of images) {
      try {
        const { bytes, contentType } = await fetchDocumentBytes(img.ref);
        const key = await putKycDocument(submission.lawyerId, bytes, contentType);
        if (key) rows.push({ id: crypto.randomUUID(), submissionId: submission.id, kind: img.kind, s3Key: key });
      } catch (err) {
        console.error("[kyc] failed to ingest one image for", submission.id, err);
      }
    }
    if (rows.length > 0) {
      await conn.insert(schema.kycDocuments).values(rows);
      ingestedDocuments = rows.length;
    }
  }

  // 4. Reconcile submission status.
  const now = new Date();
  const decided = status === "approved" || status === "rejected";
  await conn
    .update(schema.kycSubmissions)
    .set({
      status,
      idmetaApplicantId: input.verificationId,
      submittedAt: submission.submittedAt ?? now,
      decidedAt: decided ? now : null,
      updatedAt: now,
    })
    .where(eq(schema.kycSubmissions.id, submission.id));

  return { submissionId: submission.id, status, ingestedDocuments };
}
