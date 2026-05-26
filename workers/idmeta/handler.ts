import type { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { bootstrapEnv } from "@ligala/db";
import { ingestIdmetaResult } from "@ligala/kyc";

// Consumes IDMeta ingest jobs enqueued by POST /webhooks/idmeta: finalize +
// download the captured selfie/ID into our S3 and reconcile the submission.
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  await bootstrapEnv();
  const failures: { itemIdentifier: string }[] = [];

  for (const r of event.Records) {
    try {
      const body = JSON.parse(r.body) as { verificationId?: unknown };
      if (typeof body.verificationId !== "string" || body.verificationId.length === 0) {
        console.error("[idmeta-worker] invalid message", r.messageId, r.body.slice(0, 200));
        failures.push({ itemIdentifier: r.messageId });
        continue;
      }
      const result = await ingestIdmetaResult({ verificationId: body.verificationId });
      if (result.notFound) {
        // No submission maps to this verification — non-retryable; log & ack.
        console.error("[idmeta-worker] submission not found", body.verificationId);
        continue;
      }
      console.info("[idmeta-worker] ingested", body.verificationId, result.status, result.ingestedDocuments);
    } catch (err) {
      console.error("[idmeta-worker] ingest failed", r.messageId, err);
      failures.push({ itemIdentifier: r.messageId });
    }
  }

  return { batchItemFailures: failures };
}
