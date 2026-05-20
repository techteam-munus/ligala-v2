import Link from "next/link";
import { api } from "@/lib/api";
import { KycInbox } from "./inbox";

type Row = {
  submission: {
    id: string;
    lawyerId: string;
    status: string;
    createdAt: string;
    submittedAt: string | null;
  };
  lawyerEmail: string;
  lawyerName: string;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function AdminKycPage() {
  const { items } = await safe<{ items: Row[] }>("/admin/kyc", { items: [] });
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">KYC inbox</h1>
      <p className="mt-2 text-muted-foreground">
        Pending submissions awaiting a manual decision (IDMeta fallback / admin override).
      </p>
      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Nothing pending — IDMeta is on top of it.
        </p>
      ) : (
        <KycInbox items={items} />
      )}
      <p className="mt-8 text-xs text-muted-foreground">
        <Link href="/admin/dashboard" className="underline">← Admin dashboard</Link>
      </p>
    </main>
  );
}
