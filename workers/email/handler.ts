import type { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { eq, sql } from "drizzle-orm";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { bootstrapEnv, db, schema } from "@ligala/db";
import { renderEmail } from "@ligala/email";
import { emailMessage } from "@ligala/shared/schemas";

let ses: SESClient | null = null;
function client(): SESClient {
  if (!ses) ses = new SESClient({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  return ses;
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  await bootstrapEnv();
  const failures: { itemIdentifier: string }[] = [];

  for (const r of event.Records) {
    try {
      const parsed = emailMessage.safeParse(JSON.parse(r.body));
      if (!parsed.success) {
        console.error("[email-worker] invalid message", r.messageId, parsed.error.flatten());
        failures.push({ itemIdentifier: r.messageId });
        continue;
      }
      const msg = parsed.data;
      const conn = db();

      const existing = await conn.query.emailLog.findFirst({ where: eq(schema.emailLog.dedupeKey, msg.dedupeKey) });
      if (existing?.status === "sent") continue; // duplicate delivery
      if (!existing) {
        // dispatchEmail awaits the queued-row INSERT before enqueuing, so the row should
        // already exist. If it doesn't, send anyway but flag it — the success UPDATE below
        // will match 0 rows and the delivery would otherwise be untracked.
        console.warn("[email-worker] no email_log row for", msg.dedupeKey, "— producer should have created it");
      }

      const { subject, html, text } = await renderEmail(msg.kind, msg.data as never);
      const out = await client().send(new SendEmailCommand({
        Source: process.env.EMAIL_FROM ?? "no-reply@mymunus.com",
        Destination: { ToAddresses: [msg.to] },
        ReplyToAddresses: [process.env.EMAIL_REPLY_TO ?? "support@mymunus.com"],
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Html: { Data: html, Charset: "UTF-8" }, Text: { Data: text, Charset: "UTF-8" } },
        },
      }));

      await conn.update(schema.emailLog)
        .set({ status: "sent", attempts: sql`${schema.emailLog.attempts} + 1`, providerMessageId: out.MessageId ?? null, sentAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.emailLog.dedupeKey, msg.dedupeKey));
    } catch (err) {
      console.error("[email-worker] send failed", r.messageId, err);
      try {
        const body = JSON.parse(r.body) as { dedupeKey?: string };
        if (body.dedupeKey) {
          await db().update(schema.emailLog)
            .set({ status: "failed", attempts: sql`${schema.emailLog.attempts} + 1`, error: String(err).slice(0, 500), updatedAt: new Date() })
            .where(eq(schema.emailLog.dedupeKey, body.dedupeKey));
        }
      } catch { /* ignore secondary failure */ }
      failures.push({ itemIdentifier: r.messageId });
    }
  }

  return { batchItemFailures: failures };
}
