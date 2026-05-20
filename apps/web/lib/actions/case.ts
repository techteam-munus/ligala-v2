"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  caseAttachmentInput,
  caseCloseInput,
  caseCreateInput,
  caseDecisionInput,
  caseNoteInput,
  engagementDecisionInput,
  engagementInput,
  type CaseAttachmentInput,
  type CaseCloseInput,
  type CaseCreateInput,
  type CaseDecisionInput,
  type CaseNoteInput,
  type EngagementDecisionInput,
  type EngagementInput,
} from "@ligala/shared/schemas";
import { api } from "@/lib/api";

export async function createCase(input: CaseCreateInput) {
  const parsed = caseCreateInput.parse(input);
  const res = await api<{ case: { id: string } }>("/cases", {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  redirect(`/cases/${res.case.id}`);
}

export async function decideOnCase(caseId: string, input: CaseDecisionInput) {
  const parsed = caseDecisionInput.parse(input);
  await api(`/cases/${caseId}/decision`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/lawyer/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
}

export async function closeCase(caseId: string, input: CaseCloseInput) {
  const parsed = caseCloseInput.parse(input);
  await api(`/cases/${caseId}/close`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/lawyer/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
}

export async function addCaseNote(caseId: string, input: CaseNoteInput) {
  const parsed = caseNoteInput.parse(input);
  await api(`/cases/${caseId}/notes`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/lawyer/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
}

export async function addCaseAttachment(caseId: string, input: CaseAttachmentInput) {
  const parsed = caseAttachmentInput.parse(input);
  await api(`/cases/${caseId}/attachments`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/lawyer/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
}

export async function sendEngagement(caseId: string, input: EngagementInput) {
  const parsed = engagementInput.parse(input);
  await api(`/engagements/cases/${caseId}`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/lawyer/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
}

export async function decideOnEngagement(
  engagementId: string,
  caseId: string,
  input: EngagementDecisionInput,
) {
  const parsed = engagementDecisionInput.parse(input);
  await api(`/engagements/${engagementId}/decision`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/lawyer/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
}
