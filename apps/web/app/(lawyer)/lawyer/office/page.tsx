import { api } from "@/lib/api";
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
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Office</h1>
      <p className="mt-2 text-neutral-600">
        Where clients reach you and when. Add an office to enable scheduling and FAQs.
      </p>
      <OfficeSection initial={data} />
    </main>
  );
}
