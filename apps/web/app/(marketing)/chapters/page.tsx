import Link from "next/link";
import type { Metadata } from "next";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "IBP chapters · Ligala",
  description:
    "Integrated Bar of the Philippines chapters represented on Ligala. Browse chapter members.",
};

type Chapter = {
  id: string;
  name: string;
  region: string;
  city: string | null;
  memberCount: number;
};

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

export default async function ChaptersIndexPage() {
  const { items } = await safe<{ items: Chapter[] }>("/directory/chapters", {
    items: [],
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">IBP chapters</h1>
      <p className="mt-2 text-neutral-600">
        Browse the Integrated Bar of the Philippines chapters represented by
        verified lawyers on Ligala.
      </p>

      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((ch) => (
          <li key={ch.id}>
            <Link
              href={`/chapters/${ch.id}` as never}
              className="block rounded border border-neutral-200 p-4 hover:border-neutral-500"
            >
              <p className="font-medium">{ch.name}</p>
              <p className="mt-1 text-sm text-neutral-500">
                {[ch.city, ch.region].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                {ch.memberCount} verified member{ch.memberCount === 1 ? "" : "s"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
