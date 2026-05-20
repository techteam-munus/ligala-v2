import { api } from "@/lib/api";
import { NewCaseForm } from "./form";

type Ref = { id: string; name: string };
type RefList = { items: Ref[] };

type LawyerSnippet = {
  profile: { slug: string; name: string };
};

type ReferralLinkLookup = {
  slug: string;
  label: string | null;
  lawyer: { slug: string };
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const lawyerSlugParam = pick("lawyer");
  const refSlug = pick("ref")?.toUpperCase();

  // If a referral link is supplied, look it up first — if it binds to a
  // lawyer, use that as the default (the client can still override by
  // editing the lawyer slug).
  const refLookup = refSlug
    ? await safe<ReferralLinkLookup | null>(
        `/directory/referral-links/${encodeURIComponent(refSlug)}`,
        null,
      )
    : null;
  const lawyerSlug = lawyerSlugParam ?? refLookup?.lawyer.slug ?? "";

  const [practice, jurisdictions, lawyer] = await Promise.all([
    safe<RefList>("/references/practice-areas", { items: [] }),
    safe<RefList>("/references/jurisdictions", { items: [] }),
    lawyerSlug
      ? safe<LawyerSnippet | null>(
          `/directory/lawyers/${encodeURIComponent(lawyerSlug)}`,
          null,
        )
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Open a case</h1>
      <p className="mt-2 text-neutral-600">
        Share the basics. The lawyer reviews and accepts or declines.
      </p>
      {lawyer ? (
        <p className="mt-4 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
          Engaging <strong>{lawyer.profile.name}</strong>
        </p>
      ) : null}
      {refLookup ? (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Referred via <span className="font-mono">{refLookup.slug}</span>
          {refLookup.label ? ` (${refLookup.label})` : ""}.
        </p>
      ) : null}
      <NewCaseForm
        lawyerSlug={lawyer?.profile.slug ?? lawyerSlug ?? ""}
        referralLinkSlug={refLookup?.slug}
        practiceAreas={practice.items}
        jurisdictions={jurisdictions.items}
      />
    </main>
  );
}
