"use server";

import { redirect } from "next/navigation";
import { api } from "@/lib/api";

export async function becomeLawyer() {
  await api("/accounts/role", {
    method: "POST",
    body: JSON.stringify({ role: "lawyer" }),
  });
  redirect("/lawyer/dashboard");
}
