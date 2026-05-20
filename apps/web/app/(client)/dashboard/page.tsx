import Link from "next/link";
import { getSession } from "@/lib/session";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TILES: { href: string; title: string; sub: string }[] = [
  { href: "/lawyers", title: "Find a lawyer", sub: "Browse verified Philippine lawyers." },
  { href: "/lawyers?probono=true", title: "Pro bono lawyers", sub: "Lawyers accepting pro bono cases." },
  { href: "/chapters", title: "IBP chapters", sub: "Browse by local bar chapter." },
  { href: "/cases", title: "Your cases", sub: "Engagements, signing, activity." },
  { href: "/invoices", title: "Invoices", sub: "Pay bills, see history." },
  { href: "/profile", title: "Your profile", sub: "Contact info." },
];

export default async function ClientDashboard() {
  const session = await getSession();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as <strong>{session?.user.email}</strong> (role:{" "}
        <code>{session?.user.role}</code>).
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href as never} className="block">
            <Card className="gap-2 py-4 transition-colors hover:border-foreground/40">
              <CardHeader className="px-4">
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.sub}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/become-a-lawyer">I&apos;m a lawyer — list my practice</Link>
        </Button>
      </div>
    </main>
  );
}
