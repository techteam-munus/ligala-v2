import { Button, Text } from "@react-email/components";
import * as React from "react";
import { Layout } from "./layout";

export function PaymentReceipt({
  clientName,
  invoiceNumber,
  amountPaidFormatted,
  currency,
  paidAtFormatted,
  invoiceUrl,
}: {
  clientName: string;
  invoiceNumber: string;
  amountPaidFormatted: string;
  currency: string;
  paidAtFormatted: string;
  invoiceUrl: string;
}) {
  return (
    <Layout>
      <Text style={{ fontSize: 16, color: "#111" }}>Hi {clientName},</Text>
      <Text style={{ fontSize: 14, color: "#333" }}>
        We received your payment of {amountPaidFormatted} for invoice {invoiceNumber} on {paidAtFormatted}.
      </Text>
      <Button href={invoiceUrl} style={{ backgroundColor: "#111", color: "#fff", borderRadius: 6, padding: "12px 20px", fontSize: 14 }}>View invoice</Button>
    </Layout>
  );
}
