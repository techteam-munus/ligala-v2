"use server";

import { revalidatePath } from "next/cache";
import { clientProfilePatch, type ClientProfilePatch } from "@ligala/shared/schemas";
import { api } from "@/lib/api";

export async function saveClientProfile(input: ClientProfilePatch) {
  const parsed = clientProfilePatch.parse(input);
  await api("/accounts/profile", {
    method: "PATCH",
    body: JSON.stringify(parsed),
  });
  revalidatePath("/profile");
}
