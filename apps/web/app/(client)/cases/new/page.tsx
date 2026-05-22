import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { PageHero } from "@/app/_components/page-hero";
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

  const backHref = lawyer ? `/lawyers/${lawyer.profile.slug}` : "/lawyers";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <Link
        href={backHref as never}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {lawyer ? "Back to lawyer" : "Browse lawyers"}
      </Link>

      <div className="mt-3">
        <PageHero
          eyebrow="Client · Engage"
          title="Open a case"
          summary="Share the basics. The lawyer reviews and accepts or declines."
        />
      </div>

      <div className="mt-6">
        <NewCaseForm
          lawyerSlug={lawyer?.profile.slug ?? lawyerSlug ?? ""}
          lawyerName={lawyer?.profile.name ?? null}
          referralLinkSlug={refLookup?.slug}
          referralLabel={refLookup?.label ?? null}
          practiceAreas={practice.items}
          jurisdictions={jurisdictions.items}
        />
      </div>
    </main>
  );
}
