import Link from "next/link";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <p className="mt-2 text-muted-foreground">
        Browse the Integrated Bar of the Philippines chapters represented by
        verified lawyers on Ligala.
      </p>

      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((ch) => (
          <li key={ch.id}>
            <Link href={`/chapters/${ch.id}` as never} className="block">
              <Card className="gap-2 py-4 transition-colors hover:border-foreground/40">
                <CardHeader className="px-4">
                  <CardTitle>{ch.name}</CardTitle>
                  <CardDescription>
                    {[ch.city, ch.region].filter(Boolean).join(" · ")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">
                    {ch.memberCount} verified member{ch.memberCount === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
