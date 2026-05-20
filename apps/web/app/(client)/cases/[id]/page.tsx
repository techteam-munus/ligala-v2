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

  const [notesRes, attachRes, actsRes] = await Promise.all([
    load<{ notes: Note[] }>(`/cases/${id}/notes`),
    load<{ items: Attachment[] }>(`/cases/${id}/attachments`),
    load<{ items: Activity[] }>(`/cases/${id}/activities`),
  ]);

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
    </main>
  );
}
