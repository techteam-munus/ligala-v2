import { Button, Text } from "@react-email/components";
import * as React from "react";
import { Layout } from "./layout";

const EVENT_COPY: Record<string, string> = {
  case_created: "{actorName} sent you a new case request: {caseRef}.",
  case_accepted: "{actorName} accepted your case: {caseRef}.",
  case_declined: "{actorName} declined your case: {caseRef}.",
  engagement_sent: "{actorName} sent engagement terms for {caseRef}.",
  engagement_signed: "{actorName} signed the engagement for {caseRef}. The case is now active.",
  engagement_declined: "{actorName} declined the engagement for {caseRef}.",
  case_closed: "{caseRef} has been closed by {actorName}.",
};

export function CaseStatus({
  recipientName,
  caseRef,
  event,
  actorName,
  caseUrl,
}: {
  recipientName: string;
  caseRef: string;
  event: string;
  actorName: string;
  caseUrl: string;
}) {
  const bodyLine = (EVENT_COPY[event] ?? "Update on {caseRef}.")
    .replace("{actorName}", actorName)
    .replace("{caseRef}", caseRef);

  return (
    <Layout>
      <Text style={{ fontSize: 16, color: "#111" }}>Hi {recipientName},</Text>
      <Text style={{ fontSize: 14, color: "#333" }}>{bodyLine}</Text>
      <Button href={caseUrl} style={{ backgroundColor: "#111", color: "#fff", borderRadius: 6, padding: "12px 20px", fontSize: 14 }}>Open case</Button>
    </Layout>
  );
}
