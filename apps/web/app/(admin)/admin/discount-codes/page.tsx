import { api } from "@/lib/api";
import { CodesList } from "./list";

type Row = {
  code: {
    id: string;
    code: string;
    kind: "percent" | "fixed";
    valueBps: number | null;
    valueCents: number | null;
    redemptions: number;
    maxRedemptions: number | null;
    validUntil: string | null;
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

export default async function AdminDiscountCodesPage() {
  const { items } = await safe<{ items: Row[] }>("/admin/discount-codes", { items: [] });
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Discount codes</h1>
      <p className="mt-2 text-muted-foreground">
        Every active code across the platform. Use the moderation removal button
        for codes that violate policy.
      </p>
      <CodesList items={items} />
    </main>
  );
}
