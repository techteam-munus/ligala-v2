import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Ligala
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Button asChild variant="ghost" size="sm">
              <Link href="/lawyers">Find a lawyer</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/chapters">IBP chapters</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/about">About</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="ml-2">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Ligala. All rights reserved.</p>
          <nav className="flex gap-4">
            <Link href="/about" className="hover:text-foreground">About</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/become-a-lawyer" className="hover:text-foreground">Join as lawyer</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
