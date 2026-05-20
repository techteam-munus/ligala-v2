import type { SQSEvent, SQSBatchResponse } from "aws-lambda";

// Phase 5: consume PayPal IPN/webhook events from SQS, update billing state.
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  console.log("[paypal-worker] received", event.Records.length, "records");
  return { batchItemFailures: [] };
}
