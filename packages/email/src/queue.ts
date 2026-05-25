import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { db, schema } from "@ligala/db";
import type { EmailMessage } from "@ligala/shared/schemas";

let client: SQSClient | null = null;
function sqs(): SQSClient {
  if (!client) client = new SQSClient({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  return client;
}

/** Enqueue only. No-ops (logs) when EMAIL_QUEUE_URL is unset so importing this
 *  in a runtime without SQS access (e.g. web/Amplify) never throws. */
export async function enqueueEmail(msg: EmailMessage): Promise<void> {
  const url = process.env.EMAIL_QUEUE_URL;
  if (!url) {
    console.warn("[email] EMAIL_QUEUE_URL unset; skipping enqueue", msg.kind, msg.dedupeKey);
    return;
  }
  await sqs().send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify(msg) }));
}

/** Record an email_log(queued) row (idempotent on dedupeKey), then enqueue.
 *  Producer-facing entry point. Swallows errors so it never fails the caller's
 *  request — a lost notification is recoverable; a failed user action is not. */
export async function dispatchEmail(msg: EmailMessage): Promise<void> {
  try {
    await db()
      .insert(schema.emailLog)
      .values({ id: crypto.randomUUID(), kind: msg.kind, recipient: msg.to, dedupeKey: msg.dedupeKey, status: "queued" })
      .onConflictDoNothing({ target: schema.emailLog.dedupeKey });
    await enqueueEmail(msg);
  } catch (err) {
    console.error("[email] dispatchEmail failed", msg.kind, msg.dedupeKey, err);
  }
}
