import { api } from "@/lib/api";
import { getSession } from "@/lib/session";
import { PageHero } from "@/app/_components/page-hero";
import { ClientProfileForm } from "./form";

type ProfileResponse = {
  profile: {
    userId: string;
    displayName: string | null;
    phone: string | null;
    city: string | null;
    region: string | null;
    preferredLanguage: string;
  };
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function ClientProfilePage() {
  const [res, avatar, session] = await Promise.all([
    safe<ProfileResponse>("/accounts/profile", {
      profile: {
        userId: "",
        displayName: null,
        phone: null,
        city: null,
        region: null,
        preferredLanguage: "en",
      },
    }),
    safe<{ url: string | null }>("/accounts/avatar-url", { url: null }),
    getSession(),
  ]);

  const fallbackInitial = (
    res.profile.displayName ||
    session?.user.name ||
    session?.user.email ||
    "?"
  )
    .charAt(0)
    .toUpperCase();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <PageHero
        eyebrow="Client · Account"
        title="Your profile"
        summary="Lawyers you engage will see this info to reach you. Keep it current."
      />
      <div className="mt-6">
        <ClientProfileForm
          initial={{
            displayName: res.profile.displayName ?? "",
            phone: res.profile.phone ?? "",
            city: res.profile.city ?? "",
            region: res.profile.region ?? "",
            preferredLanguage: res.profile.preferredLanguage,
          }}
          avatarUrl={avatar.url}
          fallbackInitial={fallbackInitial}
        />
      </div>
    </main>
  );
}
