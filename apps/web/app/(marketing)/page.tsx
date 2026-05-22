import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CreditCard,
  FileSignature,
  HeartHandshake,
  Receipt,
  ScrollText,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  TicketPercent,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DirectoryCount = { total: number };
type Chapter = { id: string };

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const [lawyers, chaptersRes] = await Promise.all([
    safe<DirectoryCount>("/directory/lawyers?pageSize=1", { total: 0 }),
    safe<{ items: Chapter[] }>("/directory/chapters", { items: [] }),
  ]);
  const verifiedCount = lawyers.total;
  const chapterCount = chaptersRes.items.length;

  return (
    <main>
      {/* Hero --------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border/60">
        {/* Decorative grid pattern */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,oklch(0_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0_0_0/0.04)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] dark:[background-image:linear-gradient(to_right,oklch(1_0_0/0.06)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.06)_1px,transparent_1px)]"
        />
        <div className="relative mx-auto flex max-w-5xl flex-col items-start gap-7 px-6 py-20 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span
              className="size-1.5 rounded-full bg-emerald-500"
              aria-hidden
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
              Now in early access · Philippines
            </span>
          </span>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Find the right{" "}
            <span className="relative inline-block">
              <span className="relative">Philippine lawyer</span>
              <svg
                aria-hidden
                viewBox="0 0 220 8"
                className="absolute -bottom-1 left-0 right-0 w-full text-emerald-500/70"
              >
                <path
                  d="M2 5 Q 55 2, 110 5 T 218 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
            <br className="hidden sm:block" />
            Manage the whole engagement in one place.
          </h1>

          <p className="max-w-2xl text-lg text-foreground/80">
            Search verified IBP-member lawyers by practice area and chapter,
            sign a transparent engagement, and handle invoices, pro bono cases,
            and referrals — without leaving the platform.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/lawyers">
                <Search />
                Find a lawyer
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/become-a-lawyer">Join as a lawyer</Link>
            </Button>
          </div>

          {/* Trust strip */}
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium tabular-nums text-foreground">
                {verifiedCount.toLocaleString("en-PH")}
              </span>{" "}
              verified {verifiedCount === 1 ? "lawyer" : "lawyers"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-3.5 text-muted-foreground/70" />
              <span className="font-medium tabular-nums text-foreground">
                {chapterCount.toLocaleString("en-PH")}
              </span>{" "}
              IBP {chapterCount === 1 ? "chapter" : "chapters"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-muted-foreground/70" />
              PayMongo + PayPal
            </span>
          </div>
        </div>
      </section>

      {/* Pillars ------------------------------------------------------ */}
      <section className="border-b border-border/60 bg-muted/15">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Why Ligala
          </p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Three commitments we hold above everything else.
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {PILLARS.map((p) => (
              <PillarCard key={p.title} pillar={p} />
            ))}
          </div>
        </div>
      </section>

      {/* For clients + For lawyers ----------------------------------- */}
      <section className="border-b border-border/60">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-2">
          {/* For clients */}
          <article>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              For clients
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Find counsel you can trust.
            </h2>
            <p className="mt-2 max-w-md text-muted-foreground">
              Tell us your situation, see lawyers who can actually help, sign a
              clear engagement, and pay through PayMongo or PayPal — all from
              your dashboard.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              <FeatureItem icon={<ShieldCheck />} label="KYC-verified profiles only" />
              <FeatureItem icon={<FileSignature />} label="Read terms before you sign anything" />
              <FeatureItem icon={<HeartHandshake />} label="Pro bono lawyers clearly tagged" />
              <FeatureItem icon={<Receipt />} label="Pay, refunds, and history in one ledger" />
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/lawyers">
                  <Search />
                  Browse directory
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/lawyers?probono=true">
                  <HeartHandshake />
                  Pro bono lawyers
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/chapters">
                  By IBP chapter
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </article>

          {/* For lawyers */}
          <article className="md:border-l md:border-border/60 md:pl-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              For lawyers
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Run a modern practice.
            </h2>
            <p className="mt-2 max-w-md text-muted-foreground">
              Set up your public profile, get IDMeta-verified, take paid or pro
              bono cases, issue invoices, and grow through lawyer-to-lawyer
              referrals.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              <FeatureItem icon={<Sparkles />} label="A public profile that ranks in search" />
              <FeatureItem icon={<ScrollText />} label="Digital engagements: hourly, flat, contingency" />
              <FeatureItem icon={<TicketPercent />} label="Your own namespace of discount codes" />
              <FeatureItem icon={<Share2 />} label="Trackable referral links with attribution" />
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/become-a-lawyer">Get started</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </article>
        </div>
      </section>

      {/* Bottom CTA --------------------------------------------------- */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <Card className="overflow-hidden bg-gradient-to-br from-muted/30 via-card to-card">
            <CardContent className="grid items-center gap-6 px-6 py-8 md:grid-cols-[1fr_auto] md:px-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Get started
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Pick a side. Open Ligala.
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Free during early access — no platform fee on payments
                  today. We&apos;ll give 60 days notice if that ever changes.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row md:flex-col md:items-stretch">
                <Button asChild size="lg">
                  <Link href="/lawyers">
                    <Search />
                    Find a lawyer
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/become-a-lawyer">Join as a lawyer</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

const PILLARS = [
  {
    title: "Verified lawyers only",
    body:
      "Every lawyer on Ligala has passed IDMeta identity verification and lists their IBP chapter — search results never include unverified accounts.",
    accent: "bg-emerald-500",
    accentRing: "ring-emerald-200/60 dark:ring-emerald-900/30",
    icon: <ShieldCheck />,
    tone: "text-emerald-700 dark:text-emerald-300",
  },
  {
    title: "Transparent engagements",
    body:
      "Hourly, flat, or contingency terms are written into a digital engagement the client signs before any work begins.",
    accent: "bg-sky-500",
    accentRing: "ring-sky-200/60 dark:ring-sky-900/30",
    icon: <FileSignature />,
    tone: "text-sky-700 dark:text-sky-300",
  },
  {
    title: "Billing built in",
    body:
      "Invoices with line items, per-lawyer discount codes, PayMongo / PayPal checkout, and a clean transactions ledger.",
    accent: "bg-amber-500",
    accentRing: "ring-amber-200/60 dark:ring-amber-900/30",
    icon: <Receipt />,
    tone: "text-amber-700 dark:text-amber-300",
  },
] as const;

function PillarCard({
  pillar,
}: {
  pillar: (typeof PILLARS)[number];
}) {
  return (
    <Card size="sm" className="relative">
      <div
        className={cn(
          "absolute inset-y-3 left-0 w-[2px] rounded-r-full ring-1 ring-inset",
          pillar.accent,
          pillar.accentRing,
        )}
        aria-hidden
      />
      <CardContent>
        <span
          className={cn(
            "mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-card ring-1 ring-inset ring-border/60",
            pillar.tone,
          )}
        >
          {pillar.icon}
        </span>
        <h3 className="text-base font-semibold tracking-tight">
          {pillar.title}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{pillar.body}</p>
      </CardContent>
    </Card>
  );
}

function FeatureItem({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-200/60 dark:text-emerald-300 dark:ring-emerald-900/40 [&_svg]:size-3">
        <CheckCircle2 />
      </span>
      <span className="text-foreground/85">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground/60 [&_svg]:size-3.5">{icon}</span>
          {label}
        </span>
      </span>
    </li>
  );
}
