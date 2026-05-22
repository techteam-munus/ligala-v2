import { api } from "@/lib/api";
import { PageHero } from "@/app/_components/page-hero";
import { OfficeSection } from "./section";

type OfficeResponse = {
  office: {
    id: string;
    name: string;
    addressLine1: string | null;
    city: string | null;
    region: string | null;
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
  faqs: { id: string; question: string; answer: string; sortOrder: number }[];
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function OfficePage() {
  const data = await safe<OfficeResponse>("/lawyers/office", {
    office: null,
    schedule: [],
    faqs: [],
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <PageHero
        eyebrow="Lawyer · Practice"
        title="Office"
        summary="Where clients reach you and when. Add an office to enable scheduling and FAQs on your public profile."
      />
      <div className="mt-6">
        <OfficeSection initial={data} />
      </div>
    </main>
  );
}
