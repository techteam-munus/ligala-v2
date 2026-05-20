"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  applyDiscount,
  checkoutInvoice,
  sendInvoice,
  voidInvoice,
} from "@/lib/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  notesMd: string | null;
  dueAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
};

export type Line = {
  id: string;
  description: string;
  qtyThousandths: number;
  unitAmountCents: number;
  lineTotalCents: number;
};

export type PaymentRow = {
  id: string;
  provider: string;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: string;
};

export type TxRow = {
  id: string;
  kind: string;
  direction: string;
  amountCents: number;
  currency: string;
  note: string | null;
  createdAt: string;
};

export type AppliedCode = {
  code: string;
  kind: "percent" | "fixed";
  valueBps: number | null;
  valueCents: number | null;
} | null;

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function InvoiceDetail({
  viewerRole,
  invoice,
  lines,
  payments,
  transactions,
  appliedCode,
}: {
  viewerRole: "client" | "lawyer";
  invoice: InvoiceRow;
  lines: Line[];
  payments: PaymentRow[];
  transactions: TxRow[];
  appliedCode: AppliedCode;
}) {
  return (
    <div className="space-y-8">
      <header className="pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{invoice.number}</h1>
          <StatusChip status={invoice.status} />
        </div>
        {invoice.dueAt ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Due {new Date(invoice.dueAt).toLocaleDateString()}
          </p>
        ) : null}
        <Separator className="mt-4" />
      </header>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Line items
        </h2>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.description}</TableCell>
                <TableCell className="text-right">
                  {(l.qtyThousandths / 1000).toFixed(3)}
                </TableCell>
                <TableCell className="text-right">
                  {money(l.unitAmountCents, invoice.currency)}
                </TableCell>
                <TableCell className="text-right">
                  {money(l.lineTotalCents, invoice.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="text-right" colSpan={3}>
                Subtotal
              </TableCell>
              <TableCell className="text-right">
                {money(invoice.subtotalCents, invoice.currency)}
              </TableCell>
            </TableRow>
            {invoice.discountCents > 0 ? (
              <TableRow>
                <TableCell className="text-right text-muted-foreground" colSpan={3}>
                  Discount{appliedCode ? ` (${appliedCode.code})` : ""}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  −{money(invoice.discountCents, invoice.currency)}
                </TableCell>
              </TableRow>
            ) : null}
            <TableRow className="text-base font-semibold">
              <TableCell className="text-right" colSpan={3}>
                Total
              </TableCell>
              <TableCell className="text-right">
                {money(invoice.totalCents, invoice.currency)}
              </TableCell>
            </TableRow>
            {invoice.paidCents > 0 ? (
              <TableRow className="text-sm text-green-700">
                <TableCell className="text-right" colSpan={3}>
                  Paid
                </TableCell>
                <TableCell className="text-right">
                  {money(invoice.paidCents, invoice.currency)}
                </TableCell>
              </TableRow>
            ) : null}
          </TableFooter>
        </Table>
      </section>

      {invoice.notesMd ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </h2>
          <pre className="mt-2 whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-sm">
            {invoice.notesMd}
          </pre>
        </section>
      ) : null}

      {viewerRole === "lawyer" && invoice.status === "draft" ? (
        <LawyerActions invoice={invoice} />
      ) : null}

      {viewerRole === "lawyer" && ["sent", "partially_paid"].includes(invoice.status) ? (
        <VoidSection invoice={invoice} />
      ) : null}

      {["draft", "sent"].includes(invoice.status) ? (
        <DiscountSection invoice={invoice} />
      ) : null}

      {viewerRole === "client" && ["sent", "partially_paid"].includes(invoice.status) ? (
        <PayWidget invoice={invoice} />
      ) : null}

      {payments.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Payments
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {payments.map((p) => (
              <li key={p.id}>
                <Card className="gap-0 py-2">
                  <CardContent className="px-3">
                    <div className="flex items-center justify-between">
                      <span>
                        {p.provider} · {p.status}
                      </span>
                      <span>{money(p.amountCents, p.currency)}</span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {transactions.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Transactions
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {transactions.map((t) => (
              <li key={t.id}>
                <Card className="gap-0 py-2">
                  <CardContent className="px-3">
                    <div className="flex items-center justify-between">
                      <span>
                        {t.kind} · {t.direction}
                        {t.note ? ` · ${t.note}` : ""}
                      </span>
                      <span>{money(t.amountCents, t.currency)}</span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {viewerRole === "lawyer" ? (
        <Link href="/lawyer/invoices" className="block text-sm underline">
          ← All invoices
        </Link>
      ) : (
        <Link href="/invoices" className="block text-sm underline">
          ← All invoices
        </Link>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "border-green-600 text-green-700"
      : status === "void"
        ? "border-neutral-400 text-muted-foreground"
        : status === "sent" || status === "partially_paid"
          ? "border-blue-500 text-blue-700"
          : "border-amber-600 text-amber-700";
  return (
    <Badge variant="outline" className={`uppercase ${cls}`}>
      {status}
    </Badge>
  );
}

function LawyerActions({ invoice }: { invoice: InvoiceRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="gap-2 border-blue-300 bg-blue-50/50 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Send to client</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-sm">Once sent, line items become immutable.</p>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <Button
          type="button"
          disabled={pending || invoice.totalCents <= 0}
          onClick={() => {
            setError(null);
            start(async () => {
              try {
                await sendInvoice(invoice.id);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed");
              }
            });
          }}
          className="mt-3"
        >
          {pending ? "Sending…" : "Send invoice"}
        </Button>
      </CardContent>
    </Card>
  );
}

function VoidSection({ invoice }: { invoice: InvoiceRow }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Void invoice</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
        />
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || reason.length < 3}
          onClick={() => {
            setError(null);
            start(async () => {
              try {
                await voidInvoice(invoice.id, { reason });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed");
              }
            });
          }}
          className="mt-3 border-destructive text-destructive hover:text-destructive"
        >
          {pending ? "Voiding…" : "Void"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DiscountSection({ invoice }: { invoice: InvoiceRow }) {
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Apply discount code</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            className="flex-1 font-mono uppercase"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || code.length < 3}
            onClick={() => {
              setError(null);
              start(async () => {
                try {
                  await applyDiscount(invoice.id, { code });
                  setCode("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed");
                }
              });
            }}
          >
            Apply
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function PayWidget({ invoice }: { invoice: InvoiceRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay(provider: "paymongo" | "paypal" | "dev_simulate") {
    setError(null);
    start(async () => {
      try {
        const res = await checkoutInvoice(invoice.id, { provider });
        if (provider === "dev_simulate") {
          const r = await fetch(res.checkoutUrl, { method: "POST" });
          if (!r.ok) throw new Error(`simulate ${r.status}`);
          window.location.reload();
        } else {
          window.location.href = res.checkoutUrl;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card className="gap-2 border-green-300 bg-green-50/50 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Pay invoice</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-sm">
          Remaining:{" "}
          <strong>{money(invoice.totalCents - invoice.paidCents, invoice.currency)}</strong>
        </p>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={() => pay("paymongo")}>
            PayMongo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => pay("paypal")}
          >
            PayPal
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => pay("dev_simulate")}
            className="border-dashed"
          >
            Dev: simulate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
