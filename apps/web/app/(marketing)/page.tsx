import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-6 py-20 sm:py-28">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Legal services, redesigned for the Philippines
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Find the right Philippine lawyer. Manage the whole engagement in one place.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Search verified IBP-member lawyers by practice area and chapter, sign a
            transparent engagement, and handle invoices, pro bono cases, and referrals
            without leaving the platform.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/lawyers">Find a lawyer</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/become-a-lawyer">Join as a lawyer</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="mx-auto grid max-w-5xl gap-4 px-6 py-16 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <Card key={p.title}>
              <CardContent className="pt-6">
                <h3 className="text-base font-medium">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">For clients</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Tell us your situation, see lawyers who can help, sign a clear
            engagement, and pay through PayMongo or PayPal — all from your dashboard.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/lawyers?probono=true">Pro bono lawyers</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/chapters">Browse by IBP chapter</Link>
            </Button>
          </div>

          <h2 className="mt-16 text-2xl font-semibold tracking-tight">For lawyers</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Set up your public profile, get verified through IDMeta KYC, take paid or
            pro bono cases, issue invoices with discount codes, and grow through
            lawyer-to-lawyer referrals and a personal share link.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/become-a-lawyer">Get started</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

const PILLARS = [
  {
    title: "Verified lawyers only",
    body: "Every lawyer on Ligala has passed IDMeta identity verification and lists their IBP chapter — search results never include unverified accounts.",
  },
  {
    title: "Transparent engagements",
    body: "Hourly, flat, or contingency terms are written into a digital engagement the client signs before any work begins.",
  },
  {
    title: "Billing built in",
    body: "Send invoices, apply per-lawyer discount codes, accept PayMongo or PayPal, and track every payment in a clean ledger.",
  },
] as const;
