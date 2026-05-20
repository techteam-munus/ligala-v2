import { headers } from "next/headers";
import { api } from "@/lib/api";
import { LinksManager } from "./manager";

type Link = {
  id: string;
  slug: string;
  label: string | null;
  active: boolean;
  clicks: number;
  signups: number;
  createdAt: string;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function ReferralLinksPage() {
  const { items } = await safe<{ items: Link[] }>("/referrals/links", { items: [] });
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Referral links</h1>
      <p className="mt-2 text-muted-foreground">
        Share these on social, email, your own site. Anyone who starts a case
        via the link gets attributed to you in the referrals dashboard.
      </p>
      <LinksManager items={items} origin={origin} />
    </main>
  );
}
