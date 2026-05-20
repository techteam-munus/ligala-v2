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

  const caseInvoices = (invoicesRes?.items ?? []).filter(
    // Server doesn't expose caseId on the list right now; filter by status+totalCents
    // is too lossy — use list of all and link out. Phase 6 polish: API-side caseId filter.
    () => true,
  );

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
          <p className="mt-1 text-sm text-neutral-500">
            All your invoices (any case). Filter to this case in Phase 6.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {caseInvoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}` as never}
                  className="flex items-center justify-between rounded border border-neutral-200 p-2 hover:border-neutral-400"
                >
                  <span>
                    {inv.number} · {inv.status}
                  </span>
                  <span>{(inv.totalCents / 100).toFixed(2)} {inv.currency}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
