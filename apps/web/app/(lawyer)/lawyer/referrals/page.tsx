import { Inbox, Share2 } from "lucide-react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "@/app/_components/page-hero";
import { ReferralsList } from "./list";
import {
  OutboundForm,
  type CaseOption,
  type LawyerOption,
} from "./outbound-form";

type Referral = {
  id: string;
  kind: "case_referral" | "link_signup";
  fromLawyerId: string;
  toLawyerId: string;
  caseId: string | null;
  linkId: string | null;
  status: "pending" | "accepted" | "declined" | "completed";
  noteMd: string | null;
  declineReason: string | null;
  decidedAt: string | null;
  createdAt: string;
};

type DirectoryLawyer = {
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
};

type MyProfile = { profile: { slug: string } };
type CaseRow = { id: string; title: string; status: string; type: string };

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function LawyerReferralsPage() {
  const session = await getSession();
  const meId = session?.user.id ?? "";

  const [{ items }, directory, myProfile, myCases] = await Promise.all([
    safe<{ items: Referral[] }>("/referrals", { items: [] }),
    safe<{ items: DirectoryLawyer[] }>(
      "/directory/lawyers?pageSize=100",
      { items: [] },
    ),
    safe<MyProfile | null>("/lawyers/profile", null),
    safe<{ items: CaseRow[] }>("/cases", { items: [] }),
  ]);

  const mySlug = myProfile?.profile.slug ?? null;
  const lawyerOptions: LawyerOption[] = directory.items
    .filter((l) => l.slug !== mySlug)
    .map((l) => ({
      slug: l.slug,
      name: l.name,
      location: [l.city, l.region].filter(Boolean).join(", ") || null,
    }));
  const caseOptions: CaseOption[] = myCases.items.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
  }));

  const outbound = items.filter((r) => r.fromLawyerId === meId);
  const inbound = items.filter((r) => r.toLawyerId === meId);
  const inboundPending = inbound.filter((r) => r.status === "pending");
  const outboundPending = outbound.filter((r) => r.status === "pending");
  const completed = items.filter((r) => r.status === "completed").length;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHero
        eyebrow="Lawyer · Network"
        title="Referrals"
        summary="Hand cases off to another lawyer when there's a conflict, capacity issue, or specialty mismatch. Also see signups attributed via your referral links."
      />

      {/* KPI strip */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Inbound · pending"
          accent="bg-amber-500"
          accentRing="ring-amber-200/60 dark:ring-amber-900/30"
          primary={
            <span className="tabular-nums">{inboundPending.length}</span>
          }
          secondary={
            inboundPending.length === 0
              ? "Inbox clear"
              : "Need your decision"
          }
          muted={inboundPending.length === 0}
        />
        <KpiCard
          label="Inbound · all time"
          accent="bg-sky-500"
          accentRing="ring-sky-200/60 dark:ring-sky-900/30"
          primary={<span className="tabular-nums">{inbound.length}</span>}
          secondary="Total received"
          muted={inbound.length === 0}
        />
        <KpiCard
          label="Outbound · pending"
          accent="bg-violet-500"
          accentRing="ring-violet-200/60 dark:ring-violet-900/30"
          primary={
            <span className="tabular-nums">{outboundPending.length}</span>
          }
          secondary="Awaiting response"
          muted={outboundPending.length === 0}
        />
        <KpiCard
          label="Completed"
          accent="bg-emerald-500"
          accentRing="ring-emerald-200/60 dark:ring-emerald-900/30"
          primary={<span className="tabular-nums">{completed}</span>}
          secondary="Closed referrals"
          muted={completed === 0}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
        {/* Lists --------------------------------------------------- */}
        <div className="space-y-4">
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Inbox className="size-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Inbound
                </p>
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {inbound.length}
                </span>
              </div>
            </div>
            <CardContent className="px-0 py-0">
              {inbound.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nothing inbound yet.
                </p>
              ) : (
                <ReferralsList items={inbound} side="inbound" meId={meId} />
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Share2 className="size-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Outbound
                </p>
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {outbound.length}
                </span>
              </div>
            </div>
            <CardContent className="px-0 py-0">
              {outbound.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No outbound referrals yet.
                </p>
              ) : (
                <ReferralsList items={outbound} side="outbound" meId={meId} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Outbound form ------------------------------------------- */}
        <aside>
          <OutboundForm lawyers={lawyerOptions} cases={caseOptions} />
        </aside>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  accent,
  accentRing,
  primary,
  secondary,
  muted = false,
}: {
  label: string;
  accent: string;
  accentRing: string;
  primary: React.ReactNode;
  secondary: string;
  muted?: boolean;
}) {
  return (
    <Card size="sm" className="relative">
      <div
        className={cn(
          "absolute inset-y-3 left-0 w-[2px] rounded-r-full ring-1 ring-inset",
          accent,
          accentRing,
          muted && "opacity-40",
        )}
        aria-hidden
      />
      <CardContent>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tracking-tight",
            muted && "text-muted-foreground",
          )}
        >
          {primary}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>
      </CardContent>
    </Card>
  );
}
