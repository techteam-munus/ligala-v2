import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import {
  InvoiceDetail,
  type AppliedCode,
  type InvoiceRow,
  type Line,
  type PaymentRow,
  type TxRow,
} from "@/app/_components/invoice-detail";

async function load<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return null;
    throw err;
  }
}

export default async function ClientInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await load<{
    invoice: InvoiceRow;
    lines: Line[];
    payments: PaymentRow[];
    transactions: TxRow[];
    appliedCode: AppliedCode;
  }>(`/billing/invoices/${id}`);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <InvoiceDetail viewerRole="client" {...data} />
    </main>
  );
}
