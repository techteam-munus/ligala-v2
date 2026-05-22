import { Inbox, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "@/app/_components/page-hero";
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
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <PageHero
        eyebrow="Admin · Compliance"
        title="KYC inbox"
        summary={
          items.length === 0
            ? "Nothing pending — IDMeta is on top of it."
            : `${items.length} submission${items.length === 1 ? "" : "s"} awaiting a manual decision (IDMeta fallback or admin override).`
        }
      />

      <Card className="mt-6 gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Inbox className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Pending submissions
            </p>
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
          </div>
        </div>
        <CardContent className="px-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-200/60 dark:text-emerald-300 dark:ring-emerald-900/40">
                <ShieldCheck className="size-5" />
              </span>
              <p className="text-sm font-medium">Inbox is clear</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                IDMeta is handling verification automatically. Items only land
                here when manual review is required.
              </p>
            </div>
          ) : (
            <KycInbox items={items} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
