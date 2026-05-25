import { Button, Text } from "@react-email/components";
import * as React from "react";
import { Layout } from "./layout";

export function SubscriptionReceipt({
  lawyerName,
  invoiceNumber,
  amountFormatted,
  currency,
  periodEndFormatted,
  subscriptionUrl,
}: {
  lawyerName: string;
  invoiceNumber: string;
  amountFormatted: string;
  currency: string;
  periodEndFormatted: string;
  subscriptionUrl: string;
}) {
  return (
    <Layout>
      <Text style={{ fontSize: 16, color: "#111" }}>Hi {lawyerName},</Text>
      <Text style={{ fontSize: 14, color: "#333" }}>
        Your Ligala subscription payment of {amountFormatted} (invoice {invoiceNumber}) is confirmed. Your access is active through {periodEndFormatted}.
      </Text>
      <Button href={subscriptionUrl} style={{ backgroundColor: "#111", color: "#fff", borderRadius: 6, padding: "12px 20px", fontSize: 14 }}>Manage subscription</Button>
    </Layout>
  );
}
