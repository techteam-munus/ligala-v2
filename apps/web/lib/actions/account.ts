"use server";

import { revalidatePath } from "next/cache";
import { avatarUpdateInput } from "@ligala/shared/schemas";
import { api } from "@/lib/api";

// The avatar lives on `user.image`, which is read by the profile pages and the
// public lawyer directory. The signed-in sidebar updates via router.refresh()
// on the client after these resolve; revalidatePath busts the cached public
// surfaces a lawyer's photo appears on.
function revalidateAvatarSurfaces() {
  revalidatePath("/profile");
  revalidatePath("/lawyer/profile");
  revalidatePath("/lawyers");
  revalidatePath("/lawyers/[slug]", "page");
}

export async function saveAvatar(s3Key: string) {
  const parsed = avatarUpdateInput.parse({ s3Key });
  await api("/accounts/avatar", {
    method: "PATCH",
    body: JSON.stringify(parsed),
  });
  revalidateAvatarSurfaces();
}

export async function removeAvatar() {
  await api("/accounts/avatar", { method: "DELETE" });
  revalidateAvatarSurfaces();
}
