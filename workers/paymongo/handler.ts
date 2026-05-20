import type { SQSEvent, SQSBatchResponse } from "aws-lambda";

// Phase 5: consume PayMongo webhook events from SQS, idempotency via Redis key,
// update invoices/payments in Postgres, emit follow-up jobs.
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  console.log("[paymongo-worker] received", event.Records.length, "records");
  return { batchItemFailures: [] };
}
