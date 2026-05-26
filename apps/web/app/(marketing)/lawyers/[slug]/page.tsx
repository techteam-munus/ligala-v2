import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowUpRight,
  Building,
  Building2,
  Calendar,
  Globe,
  HeartHandshake,
  HelpCircle,
  Mail,
  MapPin,
  Phone,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ProfileResponse = {
  profile: {
    slug: string;
    name: string;
    photoUrl: string | null;
    bio: string | null;
    barNumber: string | null;
    verified: boolean;
    probonoAvailable: boolean;
    probonoStatement: string | null;
  };
  ibpChapter: {
    id: string;
    name: string;
    region: string;
    city: string | null;
  } | null;
  practiceAreas: { id: string; name: string }[];
  jurisdictions: { id: string; name: string }[];
  office: {
    id: string;
    name: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  } | null;
  schedule: {
    dayOfWeek: number;
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
  }[];
  faqs: { id: string; question: string; answer: string }[];
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

async function fetchProfile(slug: string): Promise<ProfileResponse | null> {
  try {
    return await api<ProfileResponse>(
      `/directory/lawyers/${encodeURIComponent(slug)}`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchProfile(slug);
  if (!data) return { title: "Lawyer not found · Ligala" };
  const cityRegion = data.office
    ? [data.office.city, data.office.region].filter(Boolean).join(", ")
    : "";
  return {
    title: `${data.profile.name} — Verified Philippine Lawyer · Ligala`,
    description:
      data.profile.bio?.slice(0, 160) ??
      `Verified Philippine lawyer${cityRegion ? ` based in ${cityRegion}` : ""}. View practice areas, jurisdictions, office details, and schedule on Ligala.`,
    openGraph: {
      title: `${data.profile.name} on Ligala`,
      description: data.profile.bio ?? undefined,
      type: "profile",
    },
  };
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function tintFor(slug: string): { bg: string; text: string; ring: string } {
  const palette = [
    {
      bg: "bg-sky-500/15",
      text: "text-sky-700 dark:text-sky-300",
      ring: "ring-sky-200/60 dark:ring-sky-900/40",
    },
    {
      bg: "bg-emerald-500/15",
      text: "text-emerald-700 dark:text-emerald-300",
      ring: "ring-emerald-200/60 dark:ring-emerald-900/40",
    },
    {
      bg: "bg-violet-500/15",
      text: "text-violet-700 dark:text-violet-300",
      ring: "ring-violet-200/60 dark:ring-violet-900/40",
    },
    {
      bg: "bg-amber-500/15",
      text: "text-amber-700 dark:text-amber-300",
      ring: "ring-amber-200/60 dark:ring-amber-900/40",
    },
    {
      bg: "bg-rose-500/15",
      text: "text-rose-700 dark:text-rose-300",
      ring: "ring-rose-200/60 dark:ring-rose-900/40",
    },
  ] as const;
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return palette[h % palette.length]!;
}

function mapsEmbedSrc(
  office: NonNullable<ProfileResponse["office"]>,
): string | null {
  if (office.latitude !== null && office.longitude !== null) {
    return `https://www.google.com/maps?q=${office.latitude},${office.longitude}&z=15&output=embed`;
  }
  const addr = [
    office.name,
    office.addressLine1,
    office.addressLine2,
    office.city,
    office.region,
    office.postalCode,
    office.country,
  ]
    .filter(Boolean)
    .join(", ");
  if (!addr) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(addr)}&z=15&output=embed`;
}

export default async function PublicLawyerProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchProfile(slug);
  if (!data) notFound();

  const {
    profile,
    office,
    schedule,
    faqs,
    practiceAreas,
    jurisdictions,
    ibpChapter,
  } = data;
  const mapSrc = office ? mapsEmbedSrc(office) : null;
  const tint = tintFor(profile.slug);
  const location = office
    ? [office.city, office.region].filter(Boolean).join(", ")
    : "";
  const engageHref = `/cases/new?lawyer=${encodeURIComponent(profile.slug)}`;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <Link
        href="/lawyers"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to directory
      </Link>

      {/* Hero ----------------------------------------------------------- */}
      <header className="mt-3 border-b border-border/60 pb-8">
        <div className="flex flex-col-reverse gap-8 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-10">
          {/* Text column ------------------------------------------------ */}
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Directory · Lawyer
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
              {profile.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {profile.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200/60 dark:text-emerald-300 dark:ring-emerald-900/40">
                  <ShieldCheck className="size-3" />
                  Verified
                </span>
              ) : null}
              {profile.probonoAvailable ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200/60 dark:text-violet-300 dark:ring-violet-900/40">
                  <HeartHandshake className="size-3" />
                  Accepts pro bono
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground/70" />
                  {location}
                </span>
              ) : null}
              {ibpChapter ? (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-muted-foreground/70" />
                  IBP {ibpChapter.name}
                </span>
              ) : null}
              {profile.barNumber ? (
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-muted-foreground/70" />
                  <span className="text-foreground tabular-nums">
                    Bar No. {profile.barNumber}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Portrait + CTA -------------------------------------------- */}
          <div className="flex flex-col items-center gap-4 md:items-end md:w-[224px]">
            <div className="relative">
              {profile.photoUrl ? (
                // Plain <img>, not next/image: presigned S3 URLs rotate hosts/
                // query params, which next/image's remotePatterns can't allow.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoUrl}
                  alt={profile.name}
                  className="size-44 shrink-0 rounded-full object-cover ring-1 ring-inset ring-border md:size-52"
                />
              ) : (
                <span
                  className={cn(
                    "flex size-44 shrink-0 items-center justify-center rounded-full text-5xl font-semibold tracking-tight ring-1 ring-inset md:size-52 md:text-6xl",
                    tint.bg,
                    tint.text,
                    tint.ring,
                  )}
                  aria-hidden
                >
                  {initialsOf(profile.name) || "?"}
                </span>
              )}
              {profile.verified ? (
                <span
                  className="absolute -bottom-1 -right-1 inline-flex size-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md ring-4 ring-background md:size-10"
                  aria-label="Verified"
                  title="KYC verified"
                >
                  <ShieldCheck className="size-4 md:size-5" />
                </span>
              ) : null}
            </div>
            <Button asChild size="lg" className="w-full md:w-auto">
              <Link href={engageHref as never}>
                Engage this lawyer
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>

        {/* Bio */}
        {profile.bio ? (
          <p className="mt-6 max-w-3xl whitespace-pre-line text-base leading-relaxed text-foreground/90">
            {profile.bio}
          </p>
        ) : null}

        {/* Pro bono callout */}
        {profile.probonoAvailable && profile.probonoStatement ? (
          <Alert className="mt-4 max-w-3xl border-violet-200/60 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20">
            <HeartHandshake className="size-4 text-violet-700 dark:text-violet-300" />
            <AlertDescription className="text-foreground/90">
              <span className="font-semibold text-violet-700 dark:text-violet-300">
                Pro bono note:
              </span>{" "}
              {profile.probonoStatement}
            </AlertDescription>
          </Alert>
        ) : null}
      </header>

      {/* Body ----------------------------------------------------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: practice / jurisdictions / FAQ ----------------------- */}
        <div className="space-y-6">
          {/* Practice areas */}
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Scale className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Practice areas
              </p>
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {practiceAreas.length}
              </span>
            </div>
            <CardContent className="px-4 py-4">
              {practiceAreas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not specified.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {practiceAreas.map((p) => (
                    <li key={p.id}>
                      <span className="inline-flex items-center rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs font-medium">
                        {p.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Jurisdictions */}
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Globe className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Jurisdictions
              </p>
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {jurisdictions.length}
              </span>
            </div>
            <CardContent className="px-4 py-4">
              {jurisdictions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not specified.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {jurisdictions.map((j) => (
                    <li key={j.id}>
                      <span className="inline-flex items-center rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs font-medium">
                        {j.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* FAQs */}
          {faqs.length > 0 ? (
            <Card className="gap-0 py-0">
              <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                <HelpCircle className="size-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Frequently asked
                </p>
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {faqs.length}
                </span>
              </div>
              <CardContent className="px-0 py-0">
                <dl className="divide-y divide-border/60">
                  {faqs.map((f) => (
                    <div key={f.id} className="px-4 py-4">
                      <dt className="text-sm font-medium">{f.question}</dt>
                      <dd className="mt-1.5 whitespace-pre-line text-sm text-foreground/80">
                        {f.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {/* Bottom CTA — for long-scroll pages */}
          <Card
            size="sm"
            className="gap-3 bg-gradient-to-br from-muted/30 to-transparent"
          >
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  Ready to engage {profile.name.split(" ")[0]}?
                </p>
                <p className="text-xs text-muted-foreground">
                  Submit a case — accepted in days, not weeks.
                </p>
              </div>
              <Button asChild>
                <Link href={engageHref as never}>
                  Engage this lawyer
                  <ArrowUpRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right rail: office / schedule / map ------------------------ */}
        <aside className="space-y-4 lg:self-start">
          {office ? (
            <>
              {/* Office details */}
              <Card className="gap-0 py-0">
                <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                  <Building className="size-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Office
                  </p>
                </div>
                <CardContent className="px-4 py-4 space-y-3 text-sm">
                  <div>
                    <p className="font-medium">{office.name}</p>
                    <p className="mt-1 text-muted-foreground">
                      {office.addressLine1}
                      {office.addressLine2 ? (
                        <>
                          <br />
                          {office.addressLine2}
                        </>
                      ) : null}
                      {office.city ||
                      office.region ||
                      office.postalCode ? (
                        <>
                          <br />
                          {[office.city, office.region, office.postalCode]
                            .filter(Boolean)
                            .join(", ")}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <ul className="space-y-1.5 border-t border-border/60 pt-3 text-xs">
                    {office.phone ? (
                      <ContactRow
                        icon={<Phone className="size-3.5" />}
                        label="Phone"
                        href={`tel:${office.phone}`}
                        value={office.phone}
                      />
                    ) : null}
                    {office.email ? (
                      <ContactRow
                        icon={<Mail className="size-3.5" />}
                        label="Email"
                        href={`mailto:${office.email}`}
                        value={office.email}
                      />
                    ) : null}
                    {office.website ? (
                      <ContactRow
                        icon={<Globe className="size-3.5" />}
                        label="Website"
                        href={office.website}
                        value={office.website.replace(/^https?:\/\//, "")}
                        external
                      />
                    ) : null}
                  </ul>
                </CardContent>
              </Card>

              {/* Map */}
              {mapSrc ? (
                <Card className="gap-0 py-0 overflow-hidden">
                  <iframe
                    title={`${office.name} location`}
                    src={mapSrc}
                    className="h-64 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </Card>
              ) : null}

              {/* Schedule */}
              {schedule.length > 0 ? (
                <Card className="gap-0 py-0">
                  <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Schedule
                    </p>
                  </div>
                  <CardContent className="px-0 py-0">
                    <ul className="divide-y divide-border/60 text-sm">
                      {DAYS.map((day, i) => {
                        const entry = schedule.find((s) => s.dayOfWeek === i);
                        const closed = !entry || entry.isClosed;
                        const range =
                          entry && entry.opensAt && entry.closesAt
                            ? `${entry.opensAt.slice(0, 5)} – ${entry.closesAt.slice(0, 5)}`
                            : null;
                        return (
                          <li
                            key={i}
                            className={cn(
                              "flex items-center justify-between px-4 py-2",
                              closed && "bg-muted/20",
                            )}
                          >
                            <span
                              className={cn(
                                "text-xs",
                                closed
                                  ? "text-muted-foreground"
                                  : "font-medium",
                              )}
                            >
                              {day}
                            </span>
                            <span
                              className={cn(
                                "tabular-nums text-xs",
                                closed
                                  ? "text-muted-foreground/70"
                                  : "text-foreground",
                              )}
                            >
                              {closed
                                ? "Closed"
                                : range ?? "By appointment"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : (
            <Card size="sm" className="gap-2 bg-muted/20">
              <CardContent>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Office
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This lawyer hasn&apos;t listed an office yet. You can still
                  engage them — they&apos;ll handle communication directly.
                </p>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}

function ContactRow({
  icon,
  label,
  href,
  value,
  external = false,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  value: string;
  external?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </span>
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
        className="inline-flex max-w-[60%] items-center gap-1 truncate text-foreground hover:underline"
      >
        <span className="truncate">{value}</span>
        {external ? (
          <ArrowUpRight className="size-3 shrink-0 opacity-60" />
        ) : null}
      </a>
    </li>
  );
}
