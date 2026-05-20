import { api } from "@/lib/api";
import { NewCaseForm } from "./form";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
      <p className="mt-2 text-muted-foreground">
        Share the basics. The lawyer reviews and accepts or declines.
      </p>
      {lawyer ? (
        <Alert className="mt-4">
          <AlertDescription>
            Engaging <strong>{lawyer.profile.name}</strong>
          </AlertDescription>
        </Alert>
      ) : null}
      {refLookup ? (
        <Alert className="mt-2 border-amber-200 bg-amber-50 text-amber-900">
          <AlertDescription className="text-xs">
            Referred via <span className="font-mono">{refLookup.slug}</span>
            {refLookup.label ? ` (${refLookup.label})` : ""}.
          </AlertDescription>
        </Alert>
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
