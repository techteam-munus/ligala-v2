"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  InvoiceDetail,
  type AppliedCode,
  type InvoiceRow,
  type Line,
  type PaymentRow,
  type TxRow,
} from "@/app/_components/invoice-detail";
import { RefundForm } from "./refund-form";

export function AdminInvoiceView({
  invoice,
  lines,
  payments,
  transactions,
  appliedCode,
}: {
  invoice: InvoiceRow;
  lines: Line[];
  payments: PaymentRow[];
  transactions: TxRow[];
  appliedCode: AppliedCode;
}) {
  return (
    <InvoiceDetail
      viewerRole="admin"
      invoice={invoice}
      lines={lines}
      payments={payments}
      transactions={transactions}
      appliedCode={appliedCode}
      renderPaymentAction={(payment) => (
        <RefundDialog invoiceId={invoice.id} payment={payment} />
      )}
    />
  );
}

function RefundDialog({
  invoiceId,
  payment,
}: {
  invoiceId: string;
  payment: PaymentRow;
}) {
  const [open, setOpen] = useState(false);
  const refunded = payment.refundedCents ?? 0;
  const remaining = payment.amountCents - refunded;
  const eligible = payment.status === "succeeded" && remaining > 0;

  if (!eligible) {
    return (
      <span className="text-[11px] text-muted-foreground/70">
        {payment.status === "refunded"
          ? "Fully refunded"
          : payment.status === "failed"
            ? "Payment failed"
            : "Not refundable"}
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Undo2 />
          Refund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue refund</DialogTitle>
          <DialogDescription>
            Reverses part or all of this payment, writes a refund ledger entry,
            and rolls back the invoice status. Provider APIs are not called
            yet — accounting only.
          </DialogDescription>
        </DialogHeader>
        <RefundForm
          invoiceId={invoiceId}
          paymentId={payment.id}
          remainingCents={remaining}
          currency={payment.currency}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
