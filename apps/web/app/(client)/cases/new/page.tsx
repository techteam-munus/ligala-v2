import { api } from "@/lib/api";
import { NewCaseForm } from "./form";

type Ref = { id: string; name: string };
type RefList = { items: Ref[] };

type LawyerSnippet = {
  profile: { slug: string; name: string };
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
  const lawyerSlug = Array.isArray(sp.lawyer) ? sp.lawyer[0] : sp.lawyer;

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
      <NewCaseForm
        lawyerSlug={lawyer?.profile.slug ?? lawyerSlug ?? ""}
        practiceAreas={practice.items}
        jurisdictions={jurisdictions.items}
      />
    </main>
  );
}
