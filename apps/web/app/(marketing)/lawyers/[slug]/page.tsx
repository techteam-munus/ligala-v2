import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api, ApiError } from "@/lib/api";

type ProfileResponse = {
  profile: {
    slug: string;
    name: string;
    bio: string | null;
    barNumber: string | null;
    verified: boolean;
  };
  ibpChapter: { id: string; name: string; region: string; city: string | null } | null;
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

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function fetchProfile(slug: string): Promise<ProfileResponse | null> {
  try {
    return await api<ProfileResponse>(`/directory/lawyers/${encodeURIComponent(slug)}`);
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
      (data.profile.bio?.slice(0, 160) ??
        `Verified Philippine lawyer${cityRegion ? ` based in ${cityRegion}` : ""}. View practice areas, jurisdictions, office details, and schedule on Ligala.`),
    openGraph: {
      title: `${data.profile.name} on Ligala`,
      description: data.profile.bio ?? undefined,
      type: "profile",
    },
  };
}

function mapsEmbedSrc(office: NonNullable<ProfileResponse["office"]>): string | null {
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

  const { profile, office, schedule, faqs, practiceAreas, jurisdictions, ibpChapter } = data;
  const mapSrc = office ? mapsEmbedSrc(office) : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{profile.name}</h1>
          <span className="rounded-full border border-green-600 px-2 py-0.5 text-xs font-medium text-green-700">
            Verified
          </span>
        </div>
        {profile.barNumber ? (
          <p className="mt-2 text-sm text-neutral-500">PH Bar No. {profile.barNumber}</p>
        ) : null}
        {ibpChapter ? (
          <p className="text-sm text-neutral-500">IBP {ibpChapter.name}</p>
        ) : null}
        {profile.bio ? (
          <p className="mt-4 max-w-2xl text-neutral-700">{profile.bio}</p>
        ) : null}
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Practice areas
          </h2>
          {practiceAreas.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Not specified.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1">
              {practiceAreas.map((p) => (
                <li
                  key={p.id}
                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                >
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Jurisdictions
          </h2>
          {jurisdictions.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Not specified.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1">
              {jurisdictions.map((j) => (
                <li
                  key={j.id}
                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                >
                  {j.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {office ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{office.name}</h2>
          <div className="mt-3 grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.4fr]">
            <div className="space-y-1 text-sm text-neutral-700">
              {office.addressLine1 ? <p>{office.addressLine1}</p> : null}
              {office.addressLine2 ? <p>{office.addressLine2}</p> : null}
              {office.city || office.region || office.postalCode ? (
                <p>
                  {[office.city, office.region, office.postalCode].filter(Boolean).join(", ")}
                </p>
              ) : null}
              <p className="text-neutral-500">{office.country}</p>
              {office.phone ? (
                <p className="mt-3">
                  <span className="text-neutral-500">Phone: </span>
                  <a href={`tel:${office.phone}`} className="underline">
                    {office.phone}
                  </a>
                </p>
              ) : null}
              {office.email ? (
                <p>
                  <span className="text-neutral-500">Email: </span>
                  <a href={`mailto:${office.email}`} className="underline">
                    {office.email}
                  </a>
                </p>
              ) : null}
              {office.website ? (
                <p>
                  <span className="text-neutral-500">Website: </span>
                  <a
                    href={office.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline"
                  >
                    {office.website}
                  </a>
                </p>
              ) : null}
            </div>

            {mapSrc ? (
              <div className="overflow-hidden rounded border border-neutral-200">
                <iframe
                  title={`${office.name} location`}
                  src={mapSrc}
                  className="h-72 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : null}
          </div>

          {schedule.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                Schedule
              </h3>
              <ul className="mt-2 divide-y divide-neutral-200 rounded border border-neutral-200 text-sm">
                {DAYS.map((day, i) => {
                  const entry = schedule.find((s) => s.dayOfWeek === i);
                  return (
                    <li key={i} className="flex items-center justify-between px-3 py-2">
                      <span className="font-medium">{day}</span>
                      <span className="text-neutral-600">
                        {!entry || entry.isClosed
                          ? "Closed"
                          : entry.opensAt && entry.closesAt
                            ? `${entry.opensAt.slice(0, 5)} – ${entry.closesAt.slice(0, 5)}`
                            : "By appointment"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {faqs.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">FAQ</h2>
          <dl className="mt-3 space-y-4">
            {faqs.map((f) => (
              <div key={f.id} className="rounded border border-neutral-200 p-4">
                <dt className="font-medium">{f.question}</dt>
                <dd className="mt-1 text-sm text-neutral-700 whitespace-pre-line">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
