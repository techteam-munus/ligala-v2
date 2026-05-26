"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const LINKS = [
  { href: "/lawyers", label: "Find a lawyer" },
  { href: "/chapters", label: "IBP chapters" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

/**
 * Mobile-only (`md:hidden`) hamburger that opens a right-side drawer with the
 * marketing nav links + auth actions. The desktop layout keeps its inline row
 * (`hidden md:flex`); this mirrors it for narrow screens so the header never
 * overflows. Closes on navigation by tracking `usePathname`.
 */
export function MarketingMobileNav({
  isAuthenticated,
  displayName,
  initial,
  userImage,
  homeHref,
}: {
  isAuthenticated: boolean;
  displayName: string;
  initial: string;
  userImage?: string | null;
  homeHref: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="md:hidden">
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <SheetTitle className="text-left text-sm font-semibold tracking-tight">
            Menu
          </SheetTitle>
        </SheetHeader>

        {isAuthenticated ? (
          <Link
            href={homeHref as never}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 border-b border-border/60 px-5 py-4 hover:bg-muted/40"
          >
            <Avatar size="sm">
              {userImage ? <AvatarImage src={userImage} alt={displayName} /> : null}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium">{displayName}</span>
          </Link>
        ) : null}

        <nav className="flex flex-col px-2 py-2">
          {LINKS.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {!isAuthenticated ? (
          <div className="mt-auto flex flex-col gap-2 border-t border-border/60 px-5 py-4">
            <Button asChild variant="outline">
              <Link href="/login" onClick={() => setOpen(false)}>
                Sign in
              </Link>
            </Button>
            <Button asChild>
              <Link href="/signup" onClick={() => setOpen(false)}>
                Get started
              </Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
