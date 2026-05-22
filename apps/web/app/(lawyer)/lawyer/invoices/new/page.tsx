import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "@/app/_components/page-hero";
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

  const resolvedCaseId = caseRow.id || caseId;
  const caseHref = `/lawyer/cases/${resolvedCaseId}`;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <Link
        href={caseHref as never}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to case
      </Link>

      <div className="mt-3">
        <PageHero
          eyebrow="Lawyer · Billing"
          title="New invoice"
          summary={
            caseRow.title ? (
              <span className="inline-flex items-center gap-1.5">
                For case
                <Link
                  href={caseHref as never}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted/40"
                >
                  <Briefcase className="size-3" />
                  {caseRow.title}
                </Link>
              </span>
            ) : (
              <>For the selected case.</>
            )
          }
        />
      </div>

      <Card className="mt-6 gap-0 py-0">
        <CardContent className="px-0">
          <NewInvoiceForm caseId={resolvedCaseId} />
        </CardContent>
      </Card>
    </main>
  );
}
