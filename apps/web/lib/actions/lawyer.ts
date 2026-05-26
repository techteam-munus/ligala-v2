"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import type {
  IdmetaStartResponse,
  KycSubmissionInput,
  LawyerProfilePatch,
  OfficeFaqInput,
  OfficeInput,
  OfficeScheduleInput,
} from "@ligala/shared/schemas";

export async function saveLawyerProfile(input: LawyerProfilePatch) {
  await api("/lawyers/profile", { method: "PATCH", body: JSON.stringify(input) });
  revalidatePath("/lawyer", "layout");
}

export async function submitKyc(input: KycSubmissionInput) {
  const res = await api<{ submissionId: string; status: string }>("/lawyers/kyc", {
    method: "POST",
    body: JSON.stringify(input),
  });
  revalidatePath("/lawyer/kyc");
  return res;
}

export async function startIdmetaVerification(): Promise<IdmetaStartResponse> {
  const res = await api<IdmetaStartResponse>("/lawyers/kyc/idmeta/start", {
    method: "POST",
  });
  revalidatePath("/lawyer/kyc");
  return res;
}

export async function createOffice(input: OfficeInput) {
  await api("/lawyers/office", { method: "POST", body: JSON.stringify(input) });
  revalidatePath("/lawyer", "layout");
}

export async function updateOffice(input: Partial<OfficeInput>) {
  await api("/lawyers/office", { method: "PATCH", body: JSON.stringify(input) });
  revalidatePath("/lawyer", "layout");
}

export async function saveOfficeSchedule(input: OfficeScheduleInput) {
  await api("/lawyers/office/schedule", { method: "PUT", body: JSON.stringify(input) });
  revalidatePath("/lawyer/office");
}

export async function addOfficeFaq(input: OfficeFaqInput) {
  await api("/lawyers/office/faqs", { method: "POST", body: JSON.stringify(input) });
  revalidatePath("/lawyer/office");
}

export async function deleteOfficeFaq(id: string) {
  await api(`/lawyers/office/faqs/${id}`, { method: "DELETE" });
  revalidatePath("/lawyer/office");
}
