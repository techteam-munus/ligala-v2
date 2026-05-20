import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import {
  CaseDetail,
  type Activity,
  type Attachment,
  type CaseRow,
  type Engagement,
  type Note,
} from "@/app/_components/case-detail";
import { Card, CardContent } from "@/components/ui/card";

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  currency: string;
};

async function load<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return null;
    throw err;
  }
}

export default async function ClientCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const head = await load<{ case: CaseRow; engagement: Engagement | null }>(`/cases/${id}`);
  if (!head) notFound();

  const [notesRes, attachRes, actsRes, invoicesRes] = await Promise.all([
    load<{ notes: Note[] }>(`/cases/${id}/notes`),
    load<{ items: Attachment[] }>(`/cases/${id}/attachments`),
    load<{ items: Activity[] }>(`/cases/${id}/activities`),
    load<{ items: InvoiceRow[] }>(`/billing/invoices`),
  ]);

  const caseInvoices = (invoicesRes?.items ?? []).filter(() => true);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <CaseDetail
        viewerRole="client"
        caseRow={head.case}
        engagement={head.engagement}
        notes={notesRes?.notes ?? []}
        attachments={attachRes?.items ?? []}
        activities={actsRes?.items ?? []}
      />
      {caseInvoices.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Invoices</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All your invoices (any case). Filter to this case in Phase 6.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {caseInvoices.map((inv) => (
              <li key={inv.id}>
                <Link href={`/invoices/${inv.id}` as never} className="block">
                  <Card className="gap-0 py-2 transition-colors hover:border-foreground/40">
                    <CardContent className="px-3">
                      <div className="flex items-center justify-between">
                        <span>
                          {inv.number} · {inv.status}
                        </span>
                        <span>
                          {(inv.totalCents / 100).toFixed(2)} {inv.currency}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
