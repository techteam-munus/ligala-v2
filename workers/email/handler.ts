import type { SQSEvent, SQSBatchResponse } from "aws-lambda";

// Phase 1: render React Email template, send via SES, log to email_log table.
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  console.log("[email-worker] received", event.Records.length, "records");
  return { batchItemFailures: [] };
}
