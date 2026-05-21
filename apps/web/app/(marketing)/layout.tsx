import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { roleHome } from "@/lib/role";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const user = session?.user;
  const displayName = user ? (user.name?.trim() || user.email.split("@")[0] || user.email) : "";
  const initial = displayName.charAt(0).toUpperCase();
  const homeHref = user ? roleHome(user.role) : "/login";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Ligala">
            <Image
              src="/ligala-logo.svg"
              alt=""
              aria-hidden
              width={25}
              height={16}
              priority
              className="h-6 w-auto shrink-0"
            />
            <Image
              src="/ligala-text.svg"
              alt="Ligala"
              width={68}
              height={22}
              priority
              className="h-5 w-auto"
            />
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
            {user ? (
              <Link
                href={homeHref as never}
                className="ml-2 flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
              >
                <Avatar size="sm">
                  {user.image ? <AvatarImage src={user.image} alt={displayName} /> : null}
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <span className="max-w-[10rem] truncate font-medium">{displayName}</span>
              </Link>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="ml-2">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/signup">Get started</Link>
                </Button>
              </>
            )}
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
