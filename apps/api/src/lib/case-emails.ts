import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { dispatchEmail } from "@ligala/email";
import { env } from "./env";
import type { z } from "zod";
import { emailMessage } from "@ligala/shared/schemas";

// Derive the event union from the shared schema so adding an event there is a
// compile error here, not a silent drift (review issue #4).
type CaseStatusEvent = Extract<
  z.infer<typeof emailMessage>,
  { kind: "case_status" }
>["data"]["event"];

/** Look up a recipient and enqueue a case_status email to them. Swallows ALL
 *  errors (including the recipient lookup) so a case/engagement state change can
 *  never be broken by an email concern. No-ops if the recipient has no email.
 *  dedupeKey is the case_activity row id → exactly one email per transition. */
export async function notifyCaseStatus(args: {
  activityId: string;
  recipientUserId: string | null;
  recipientPortal: "client" | "lawyer";
  caseId: string;
  caseRef: string;
  event: CaseStatusEvent;
  actorName: string;
}): Promise<void> {
  try {
    if (!args.recipientUserId) return;
    const recipient = await db().query.user.findFirst({
      where: eq(schema.user.id, args.recipientUserId),
    });
    if (!recipient?.email) return;
    const base = env().BETTER_AUTH_URL;
    const caseUrl =
      args.recipientPortal === "lawyer"
        ? `${base}/lawyer/cases/${args.caseId}`
        : `${base}/cases/${args.caseId}`;
    await dispatchEmail({
      kind: "case_status",
      to: recipient.email,
      dedupeKey: `case_status:${args.activityId}`,
      data: {
        recipientName: recipient.name,
        caseRef: args.caseRef,
        event: args.event,
        actorName: args.actorName,
        caseUrl,
      },
    });
  } catch (err) {
    console.error("[email] case_status dispatch failed", args.activityId, err);
  }
}
