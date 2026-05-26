import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

export interface IdmetaIngestMessage {
  verificationId: string;
}

let client: SQSClient | null = null;
function sqs(): SQSClient {
  if (!client) client = new SQSClient({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  return client;
}

/** Enqueue an ingest job. No-ops (logs) when IDMETA_QUEUE_URL is unset so the
 *  api can import this in any runtime without throwing. */
export async function enqueueIdmetaIngest(msg: IdmetaIngestMessage): Promise<void> {
  const url = process.env.IDMETA_QUEUE_URL;
  if (!url) {
    console.warn("[kyc] IDMETA_QUEUE_URL unset; skipping enqueue", msg.verificationId);
    return;
  }
  await sqs().send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify(msg) }));
}
