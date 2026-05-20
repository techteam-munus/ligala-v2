import type { SQSEvent, SQSBatchResponse } from "aws-lambda";

// Phase 2: consume IDMeta KYC webhook events from SQS, reconcile kyc_submissions
// status, fire downstream notifications (email + in-app).
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  console.log("[idmeta-worker] received", event.Records.length, "records");
  return { batchItemFailures: [] };
}
