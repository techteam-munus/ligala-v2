import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { extractImages } from "./extract";
import { fetchDocumentBytes, finalizeVerification } from "./idmeta";
import { mapIdmetaStatus, type KycStatus } from "./status";
import { putKycDocument } from "./s3";

export interface IngestInput {
  verificationId: string;
  /** Our kyc_submission id, echoed back via IDMeta metadata (primary mapping). */
  submissionId?: string;
  /** String/numeric status from the webhook, if present. */
  status?: string | number;
  /** `verification_results` from the webhook, if present (primary image source). */
  verificationResults?: unknown;
}

export interface IngestResult {
  notFound?: boolean;
  /** Set when a duplicate webhook delivery was skipped (already reconciled). */
  idempotent?: boolean;
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

  // 1. Resolve submission. Primary: our submissionId echoed back in IDMeta
  // metadata. Then the verification id we stored at /start (idmetaApplicantId).
  // Then a submission whose id equals the verification id (defensive).
  let submission = input.submissionId
    ? await conn.query.kycSubmissions.findFirst({
        where: eq(schema.kycSubmissions.id, input.submissionId),
      })
    : undefined;
  if (!submission) {
    submission = await conn.query.kycSubmissions.findFirst({
      where: eq(schema.kycSubmissions.idmetaApplicantId, input.verificationId),
    });
  }
  if (!submission) {
    submission = await conn.query.kycSubmissions.findFirst({
      where: eq(schema.kycSubmissions.id, input.verificationId),
    });
  }
  if (!submission) return { notFound: true, ingestedDocuments: 0 };

  // 2. Determine status. Prefer the webhook status; only finalize as a backstop
  // when we don't have one (the webhook's status is authoritative for
  // reconciliation — finalizing just for images isn't worth the extra call /
  // IDMeta rate limits; captured images, when a flow has them, arrive in the
  // webhook results passed below).
  let statusValue: string | number | undefined = input.status;
  let results: unknown = input.verificationResults;
  if (statusValue === undefined) {
    try {
      const finalized = (await finalizeVerification(input.verificationId)) as Record<string, unknown>;
      statusValue =
        (finalized.status_message as string | undefined) ??
        (finalized.status as string | number | undefined);
      results ??= finalized.verification_results ?? finalized;
    } catch (err) {
      console.error("[kyc] finalize backstop failed for", input.verificationId, err);
    }
  }
  const status = mapIdmetaStatus(statusValue);

  // Idempotent: duplicate webhook deliveries for an already-reconciled
  // submission are a no-op (IDMeta can fire the completion event many times).
  if (submission.idmetaApplicantId === input.verificationId && submission.status === status) {
    return { submissionId: submission.id, status, ingestedDocuments: 0, idempotent: true };
  }

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
      rejectReason: status === "rejected" ? "Identity verification was not approved by IDMeta." : null,
      updatedAt: now,
    })
    .where(eq(schema.kycSubmissions.id, submission.id));

  return { submissionId: submission.id, status, ingestedDocuments };
}
