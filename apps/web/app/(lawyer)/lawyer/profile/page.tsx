import { api } from "@/lib/api";
import { LawyerProfileForm } from "./form";

type ProfileResponse = {
  profile: {
    slug: string;
    barNumber: string | null;
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
    safe<ProfileResponse>("/lawyers/profile", { profile: null, practiceAreaIds: [], jurisdictionIds: [] }),
    api<RefList<Ref>>("/references/ibp-chapters"),
    api<RefList<Ref>>("/references/practice-areas"),
    api<RefList<Ref>>("/references/jurisdictions"),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Lawyer profile</h1>
      <p className="mt-2 text-muted-foreground">
        This is what clients see when they land on your public page.
      </p>
      <LawyerProfileForm
        initial={{
          slug: profileRes.profile?.slug ?? "",
          barNumber: profileRes.profile?.barNumber ?? "",
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
    </main>
  );
}
