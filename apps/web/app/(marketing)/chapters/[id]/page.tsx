import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Chapter = {
  id: string;
  name: string;
  region: string;
  city: string | null;
};

type Member = {
  slug: string;
  name: string;
  bio: string | null;
  probonoAvailable: boolean;
};

type ChapterResponse = { chapter: Chapter; members: Member[] };

async function load(id: string): Promise<ChapterResponse | null> {
  try {
    return await api<ChapterResponse>(`/directory/chapters/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return { title: "Chapter not found · Ligala" };
  return {
    title: `${data.chapter.name} · Ligala`,
    description: `Verified Ligala lawyers in the ${data.chapter.name} (${data.chapter.region}).`,
  };
}

export default async function ChapterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/chapters" className="underline">
          IBP chapters
        </Link>{" "}
        / {data.chapter.region}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.chapter.name}</h1>
      <p className="mt-2 text-muted-foreground">
        {[data.chapter.city, data.chapter.region].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.members.length} verified member{data.members.length === 1 ? "" : "s"} on Ligala.
      </p>

      <Link
        href={`/lawyers?chapterId=${data.chapter.id}` as never}
        className="mt-4 inline-block text-sm underline"
      >
        Search lawyers in this chapter →
      </Link>

      <ul className="mt-8 space-y-3">
        {data.members.map((m) => (
          <li key={m.slug}>
            <Card className="gap-2 py-4 transition-colors hover:border-foreground/40">
              <CardContent className="px-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/lawyers/${m.slug}` as never}
                    className="text-lg font-medium hover:underline"
                  >
                    {m.name}
                  </Link>
                  {m.probonoAvailable ? (
                    <Badge variant="outline" className="shrink-0 border-amber-600 text-amber-700">
                      Pro bono
                    </Badge>
                  ) : null}
                </div>
                {m.bio ? (
                  <p className="mt-2 line-clamp-2 text-sm">{m.bio}</p>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
