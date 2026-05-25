import { render } from "@react-email/render";
import * as React from "react";
import type { EmailKind, EmailMessage } from "@ligala/shared/schemas";
import { AuthVerify } from "./templates/auth-verify";
import { AuthReset } from "./templates/auth-reset";
import { InvoiceSent } from "./templates/invoice-sent";
import { PaymentReceipt } from "./templates/payment-receipt";
import { CaseStatus } from "./templates/case-status";
import { SubscriptionReceipt } from "./templates/subscription-receipt";

type DataFor<K extends EmailKind> = Extract<EmailMessage, { kind: K }>["data"];

const COMPONENT = {
  auth_verify: AuthVerify, auth_reset: AuthReset, invoice_sent: InvoiceSent,
  payment_receipt: PaymentReceipt, case_status: CaseStatus, subscription_receipt: SubscriptionReceipt,
} as const;

const SUBJECT: Record<EmailKind, (d: never) => string> = {
  auth_verify: () => "Verify your Ligala email",
  auth_reset: () => "Reset your Ligala password",
  invoice_sent: (d: DataFor<"invoice_sent">) => `Invoice ${d.invoiceNumber} from ${d.lawyerName}`,
  payment_receipt: (d: DataFor<"payment_receipt">) => `Payment received — invoice ${d.invoiceNumber}`,
  case_status: (d: DataFor<"case_status">) => `Update on ${d.caseRef}`,
  subscription_receipt: (d: DataFor<"subscription_receipt">) => `Your Ligala subscription receipt — ${d.invoiceNumber}`,
} as never;

export async function renderEmail<K extends EmailKind>(
  kind: K, data: DataFor<K>,
): Promise<{ subject: string; html: string; text: string }> {
  const Component = COMPONENT[kind] as (p: DataFor<K>) => React.ReactElement;
  const element = Component(data);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = (SUBJECT[kind] as (d: DataFor<K>) => string)(data);
  return { subject, html, text };
}
