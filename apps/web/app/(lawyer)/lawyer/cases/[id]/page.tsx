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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

async function load<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return null;
    throw err;
  }
}

export default async function LawyerCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const head = await load<{ case: CaseRow; engagement: Engagement | null }>(`/cases/${id}`);
  if (!head) notFound();

  const [notesRes, attachRes, actsRes] = await Promise.all([
    load<{ notes: Note[] }>(`/cases/${id}/notes`),
    load<{ items: Attachment[] }>(`/cases/${id}/attachments`),
    load<{ items: Activity[] }>(`/cases/${id}/activities`),
  ]);

  const canInvoice = ["accepted", "active", "closed"].includes(head.case.status);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <CaseDetail
        viewerRole="lawyer"
        caseRow={head.case}
        engagement={head.engagement}
        notes={notesRes?.notes ?? []}
        attachments={attachRes?.items ?? []}
        activities={actsRes?.items ?? []}
      />
      {canInvoice ? (
        <Card className="mt-10 gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">Billing</CardTitle>
            <CardDescription>
              Create an invoice for time + expenses on this case.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <Button asChild size="sm">
              <Link href={`/lawyer/invoices/new?case=${head.case.id}` as never}>
                New invoice
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
