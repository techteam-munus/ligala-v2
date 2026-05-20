import { api } from "@/lib/api";
import { DiscountCodesForm } from "./form";

type Code = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  valueBps: number | null;
  valueCents: number | null;
  redemptions: number;
  maxRedemptions: number | null;
  validUntil: string | null;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function DiscountCodesPage() {
  const { items } = await safe<{ items: Code[] }>("/billing/discount-codes", { items: [] });
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Discount codes</h1>
      <p className="mt-2 text-neutral-600">
        Codes you create live in your namespace — clients apply them at checkout.
      </p>
      <DiscountCodesForm />
      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-neutral-500">
        Your codes ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No codes yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded border border-neutral-200 p-3"
            >
              <div>
                <p className="font-mono font-medium">{c.code}</p>
                <p className="text-xs text-neutral-500">
                  {c.kind === "percent"
                    ? `${((c.valueBps ?? 0) / 100).toFixed(2)}% off`
                    : `${((c.valueCents ?? 0) / 100).toFixed(2)} PHP off`}
                  {c.maxRedemptions
                    ? ` · ${c.redemptions}/${c.maxRedemptions} used`
                    : ` · ${c.redemptions} used`}
                  {c.validUntil
                    ? ` · valid until ${new Date(c.validUntil).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
