import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type {
  AppliedCode,
  InvoiceRow,
  Line,
  PaymentRow,
  TxRow,
} from "@/app/_components/invoice-detail";
import { AdminInvoiceView } from "./admin-invoice-view";

type Resp = {
  invoice: InvoiceRow;
  lines: Line[];
  payments: PaymentRow[];
  transactions: TxRow[];
  appliedCode: AppliedCode;
};

async function load(id: string): Promise<Resp | null> {
  try {
    return await api<Resp>(`/billing/invoices/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}

export default async function AdminInvoiceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  return <AdminInvoiceView {...data} />;
}
