import type { SQSEvent, SQSBatchResponse } from "aws-lambda";

// Phase 2: resize/optimize KYC docs + lawyer photos with Sharp (provided via
// Lambda layer), write derivatives back to S3, update DB references.
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  console.log("[image-worker] received", event.Records.length, "records");
  return { batchItemFailures: [] };
}
