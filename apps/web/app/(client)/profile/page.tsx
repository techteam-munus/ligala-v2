import { api } from "@/lib/api";
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
  const res = await safe<ProfileResponse>("/accounts/profile", {
    profile: {
      userId: "",
      displayName: null,
      phone: null,
      city: null,
      region: null,
      preferredLanguage: "en",
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
      <p className="mt-2 text-neutral-600">
        Lawyers you engage will see this info to reach you. Keep it current.
      </p>
      <ClientProfileForm
        initial={{
          displayName: res.profile.displayName ?? "",
          phone: res.profile.phone ?? "",
          city: res.profile.city ?? "",
          region: res.profile.region ?? "",
          preferredLanguage: res.profile.preferredLanguage,
        }}
      />
    </main>
  );
}
