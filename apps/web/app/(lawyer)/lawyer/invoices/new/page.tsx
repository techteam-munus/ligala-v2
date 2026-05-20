import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { NewInvoiceForm } from "./form";

type CaseRow = {
  id: string;
  title: string;
  type: string;
  status: string;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const caseId = Array.isArray(sp.case) ? sp.case[0] : sp.case;
  if (!caseId) notFound();

  const { case: caseRow } = await safe<{ case: CaseRow }>(
    `/cases/${encodeURIComponent(caseId)}`,
    { case: { id: "", title: "", type: "", status: "" } },
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">New invoice</h1>
      <p className="mt-2 text-muted-foreground">
        For case <strong>{caseRow.title || caseId}</strong>.
      </p>
      <NewInvoiceForm caseId={caseRow.id || caseId} />
    </main>
  );
}
