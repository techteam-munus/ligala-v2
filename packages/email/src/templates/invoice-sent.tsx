import { Button, Text } from "@react-email/components";
import * as React from "react";
import { Layout } from "./layout";

export function InvoiceSent({
  clientName,
  lawyerName,
  invoiceNumber,
  amountFormatted,
  currency,
  invoiceUrl,
}: {
  clientName: string;
  lawyerName: string;
  invoiceNumber: string;
  amountFormatted: string;
  currency: string;
  invoiceUrl: string;
}) {
  return (
    <Layout>
      <Text style={{ fontSize: 16, color: "#111" }}>Hi {clientName},</Text>
      <Text style={{ fontSize: 14, color: "#333" }}>
        {lawyerName} sent you invoice {invoiceNumber} for {amountFormatted}.
      </Text>
      <Button href={invoiceUrl} style={{ backgroundColor: "#111", color: "#fff", borderRadius: 6, padding: "12px 20px", fontSize: 14 }}>View &amp; pay invoice</Button>
    </Layout>
  );
}
