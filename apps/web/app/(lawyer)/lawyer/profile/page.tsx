import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/app/_components/page-hero";
import { LawyerProfileForm } from "./form";

type ProfileResponse = {
  profile: {
    slug: string;
    ibpChapterId: string | null;
    bio: string | null;
    probonoAvailable: boolean;
    probonoStatement: string | null;
  } | null;
  practiceAreaIds: string[];
  jurisdictionIds: string[];
};

type RefList<T> = { items: T[] };
type Ref = { id: string; name: string };

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function LawyerProfilePage() {
  const [profileRes, ibp, practice, jurisdictions] = await Promise.all([
    safe<ProfileResponse>("/lawyers/profile", {
      profile: null,
      practiceAreaIds: [],
      jurisdictionIds: [],
    }),
    api<RefList<Ref>>("/references/ibp-chapters"),
    api<RefList<Ref>>("/references/practice-areas"),
    api<RefList<Ref>>("/references/jurisdictions"),
  ]);

  const publicSlug = profileRes.profile?.slug ?? "";

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHero
        eyebrow="Lawyer · Profile"
        title="Public profile"
        summary="This is what clients see when they land on your public page."
        actions={
          publicSlug ? (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link
                href={`/lawyers/${publicSlug}` as never}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink />
                View public page
                <ArrowUpRight className="opacity-60" />
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="mt-6">
        <LawyerProfileForm
          initial={{
            slug: profileRes.profile?.slug ?? "",
            ibpChapterId: profileRes.profile?.ibpChapterId ?? "",
            bio: profileRes.profile?.bio ?? "",
            practiceAreaIds: profileRes.practiceAreaIds,
            jurisdictionIds: profileRes.jurisdictionIds,
            probonoAvailable: profileRes.profile?.probonoAvailable ?? false,
            probonoStatement: profileRes.profile?.probonoStatement ?? "",
          }}
          ibpChapters={ibp.items}
          practiceAreas={practice.items}
          jurisdictions={jurisdictions.items}
        />
      </div>
    </main>
  );
}
