import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";

async function load<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}

export default async function LawyerCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const head = await load<{ case: CaseRow; engagement: Engagement | null }>(
    `/cases/${id}`,
  );
  if (!head) notFound();

  const [notesRes, attachRes, actsRes] = await Promise.all([
    load<{ notes: Note[] }>(`/cases/${id}/notes`),
    load<{ items: Attachment[] }>(`/cases/${id}/attachments`),
    load<{ items: Activity[] }>(`/cases/${id}/activities`),
  ]);

  const canInvoice = ["accepted", "active", "closed"].includes(
    head.case.status,
  );

  return (
    <main>
      <CaseDetail
        viewerRole="lawyer"
        caseRow={head.case}
        engagement={head.engagement}
        notes={notesRes?.notes ?? []}
        attachments={attachRes?.items ?? []}
        activities={actsRes?.items ?? []}
        extras={
          canInvoice ? (
            <Card size="sm" className="gap-2">
              <CardHeader>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Billing
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Bill the client for time and expenses on this matter.
                </p>
                <Button asChild size="sm" className="w-full">
                  <Link
                    href={`/lawyer/invoices/new?case=${head.case.id}` as never}
                  >
                    <Receipt />
                    New invoice
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null
        }
      />
    </main>
  );
}
