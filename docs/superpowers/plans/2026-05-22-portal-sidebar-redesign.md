# Portal Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic-looking shared portal sidebar (client/lawyer/admin) with an editorial visual treatment — Fraunces serif section labels, Geist Sans body, oxblood accent on warm paper — and split `portal-shell.tsx` into focused components.

**Architecture:** Existing shadcn `Sidebar` primitive stays. New CSS tokens in `globals.css` map into shadcn's `--sidebar*` variables so the primitive inherits the look without component-level overrides. Active state renders via a `::before` pseudo-element triggered by `[data-sidebar="menu-button"][data-active="true"]`. Nav config moves to a standalone typed module with a unit-tested `isNavActive` helper. `portal-shell.tsx` becomes a thin composer over `SidebarBrand`, `SidebarNav`, and `SidebarUser`.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, shadcn `Sidebar` primitive, `next/font/google` (Fraunces + Geist), Lucide icons, Better Auth, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-22-portal-sidebar-redesign-design.md`

---

## File map

### New files
- `apps/web/app/_components/portal-nav-config.ts` — typed nav data + `isNavActive` + `SEGMENT_LABELS` + `getPortalConfig`. Pure TS, no React.
- `apps/web/app/_components/portal-nav-config.test.ts` — Vitest spec for `isNavActive`.
- `apps/web/app/_components/sidebar-brand.tsx` — logo row + role tag.
- `apps/web/app/_components/sidebar-nav.tsx` — grouped nav with active-state styling.
- `apps/web/app/_components/sidebar-user.tsx` — footer dropdown (identity + sign-out).

### Modified files
- `apps/web/app/layout.tsx` — swap Inter for Fraunces + Geist Sans via `next/font/google`.
- `apps/web/app/globals.css` — add color tokens, map into `--sidebar*`, add active `::before` rule, wire `--font-serif` through `@theme inline`.
- `apps/web/app/_components/portal-shell.tsx` — slim down to a composer. Breadcrumb helpers stay inline.

### Removed (within `portal-shell.tsx`)
- Lawyer-specific dropdown items (Subscription / Invoices / Discount codes — duplicated from sidebar).
- Disabled placeholder dropdown items (Upgrade to Pro / Billing / Notifications).
- Unused icon imports after dropdown cleanup: `Sparkles`, `Bell`, `CreditCard`, `TicketPercent`.

---

## Task 1: Wire fonts and color tokens

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1.1: Swap fonts in `app/layout.tsx`**

Replace the entire file with:

```ts
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Fraunces, Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  axes: ["opsz"],
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ligala",
    template: "%s | Ligala",
  },
  description: "Philippine legal services platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", fraunces.variable, geist.variable)}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 1.2: Add color tokens, sidebar mapping, and active `::before` rule in `app/globals.css`**

Find the `:root` block (currently starts at line 8) and add these tokens at the end of the block, just before its closing brace:

```css
    /* Portal sidebar editorial tokens — added 2026-05-22 */
    --paper: oklch(0.976 0.012 80);
    --ink: oklch(0.18 0.012 60);
    --muted-ink: oklch(0.45 0.014 70);
    --oxblood: oklch(0.4 0.12 20);
    --rule: oklch(0.91 0.018 75);

    /* Map editorial tokens into shadcn sidebar primitive */
    --sidebar: var(--paper);
    --sidebar-foreground: var(--ink);
    --sidebar-border: var(--rule);
    --sidebar-accent: transparent;
    --sidebar-accent-foreground: var(--ink);
    --sidebar-ring: var(--oxblood);
```

Note: the existing `--sidebar*` lines higher up in `:root` (lines ~33–40) get overridden by these later declarations — that's the intended behavior. Don't delete the originals; the override-by-cascade pattern keeps the diff small and preserves the originals as documentation.

- [ ] **Step 1.3: Wire `--font-serif` through Tailwind's `@theme inline`**

In the `@theme inline` block (currently starts at line 92), find this line:

```css
  --font-serif: ui-serif, Georgia, serif;
```

Replace with:

```css
  --font-serif: var(--font-serif), ui-serif, Georgia, serif;
```

This matches the pattern already used for `--font-sans` on the previous line — Tailwind's theme reads the document-scoped `--font-serif` set by `next/font` and falls back to the system stack if absent.

- [ ] **Step 1.4: Append the active-state `::before` rule to `app/globals.css`**

Append at the end of the file (after the `.prose-ligala` block):

```css
/* ---------------------------------------------------------------------- */
/* Portal sidebar active-item indicator. The shadcn Sidebar primitive     */
/* sets data-active="true" on the active menu button; we render a 2px     */
/* oxblood bar flush to the left edge instead of using a background fill. */
/* ---------------------------------------------------------------------- */
[data-sidebar="menu-button"][data-active="true"] {
  position: relative;
  font-weight: 500;
  color: var(--ink);
}
[data-sidebar="menu-button"][data-active="true"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--oxblood);
}
```

- [ ] **Step 1.5: Typecheck and start the dev server to confirm fonts load**

Run from repo root:

```bash
pnpm --filter @ligala/web typecheck
```

Expected: no errors.

Then in a separate terminal:

```bash
pnpm dev
```

Open `http://localhost:3000/login` and inspect any rendered text — `--font-sans` should now be Geist Sans (rounded, neutral) instead of Inter. Skim the page for any obvious font-load failure or layout shift. The sidebar itself is not yet redesigned; we're only verifying fonts loaded.

- [ ] **Step 1.6: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "$(cat <<'EOF'
feat(web): wire Fraunces + Geist Sans and editorial color tokens

Replaces Inter with Geist Sans (--font-sans) and introduces Fraunces
(--font-serif) for editorial section labels. Adds --paper, --ink,
--muted-ink, --oxblood, --rule tokens and maps them into shadcn's
sidebar primitive variables. Adds the active-item ::before bar rule
that the redesigned sidebar will rely on.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create the nav config module

**Files:**
- Create: `apps/web/app/_components/portal-nav-config.ts`

- [ ] **Step 2.1: Write `portal-nav-config.ts`**

Create the file with this exact content:

```ts
import {
  Briefcase,
  Building,
  Building2,
  LayoutDashboard,
  Link2,
  Receipt,
  Scale,
  ScrollText,
  Search,
  Share2,
  ShieldCheck,
  TicketPercent,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Variant = "client" | "lawyer" | "admin";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };
export type PortalConfig = {
  roleTag: string;
  brandHref: string;
  groups: NavGroup[];
};

const CLIENT: PortalConfig = {
  roleTag: "CLIENT",
  brandHref: "/dashboard",
  groups: [
    {
      label: "Workspace",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/cases", label: "Cases", icon: Briefcase },
        { href: "/invoices", label: "Invoices", icon: Receipt },
        { href: "/profile", label: "Profile", icon: User },
      ],
    },
    {
      label: "Discover",
      items: [
        { href: "/lawyers", label: "Find a lawyer", icon: Search },
        { href: "/chapters", label: "IBP chapters", icon: Building2 },
      ],
    },
  ],
};

const LAWYER: PortalConfig = {
  roleTag: "LAWYER PORTAL",
  brandHref: "/lawyer/dashboard",
  groups: [
    {
      label: "Workspace",
      items: [
        { href: "/lawyer/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/lawyer/cases", label: "Cases", icon: Briefcase },
      ],
    },
    {
      label: "Growth",
      items: [
        { href: "/lawyer/referrals", label: "Referrals", icon: Share2 },
        { href: "/lawyer/referral-links", label: "Referral links", icon: Link2 },
      ],
    },
    {
      label: "Practice",
      items: [
        { href: "/lawyer/profile", label: "Public profile", icon: User },
        { href: "/lawyer/office", label: "Office", icon: Building },
        { href: "/lawyer/kyc", label: "KYC", icon: ShieldCheck },
      ],
    },
  ],
};

const ADMIN: PortalConfig = {
  roleTag: "ADMIN",
  brandHref: "/admin/dashboard",
  groups: [
    {
      label: "Overview",
      items: [
        { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "People",
      items: [
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/kyc", label: "KYC inbox", icon: ShieldCheck },
      ],
    },
    {
      label: "Money",
      items: [
        { href: "/admin/invoices", label: "Invoices", icon: Receipt },
        { href: "/admin/discount-codes", label: "Discount codes", icon: TicketPercent },
        { href: "/admin/referrals", label: "Referrals", icon: Share2 },
      ],
    },
    {
      label: "Records",
      items: [
        { href: "/admin/ibp-lawyers", label: "IBP lawyers", icon: Scale },
        { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
      ],
    },
  ],
};

// Total lookup — switch exhaustiveness lets us return PortalConfig (not | undefined)
// without `!`-asserting. noUncheckedIndexedAccess is on; see CLAUDE.md.
export function getPortalConfig(variant: Variant): PortalConfig {
  switch (variant) {
    case "client":
      return CLIENT;
    case "lawyer":
      return LAWYER;
    case "admin":
      return ADMIN;
  }
}

export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  cases: "Cases",
  invoices: "Invoices",
  profile: "Profile",
  lawyers: "Find a lawyer",
  chapters: "IBP chapters",
  referrals: "Referrals",
  "referral-links": "Referral links",
  "discount-codes": "Discount codes",
  kyc: "KYC",
  office: "Office",
  users: "Users",
  "audit-log": "Audit log",
  "ibp-lawyers": "IBP lawyers",
  subscribe: "Subscription",
  new: "New",
};

/**
 * Whether `href` should be considered the active route for `pathname`.
 *
 * Behavior:
 * - Exact match wins.
 * - Prefix match: `pathname.startsWith(href + "/")`.
 * - Routes ending in `/dashboard` only match exactly — they never match
 *   non-dashboard child routes, so the Dashboard tab does not light up
 *   when the user is on /cases, /invoices, etc.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href.endsWith("/dashboard")) return false;
  return pathname.startsWith(href + "/");
}
```

- [ ] **Step 2.2: Typecheck**

```bash
pnpm --filter @ligala/web typecheck
```

Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
git add apps/web/app/_components/portal-nav-config.ts
git commit -m "$(cat <<'EOF'
feat(web): extract portal nav config into a typed module

Pulls NAV data, SEGMENT_LABELS, and the active-route helper out of
portal-shell.tsx into a pure TS module. Adds nav grouping (Workspace /
Discover / Growth / Practice / Overview / People / Money / Records) per
role. portal-shell.tsx still imports the old shape until Task 7.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Test the `isNavActive` helper

**Files:**
- Create: `apps/web/app/_components/portal-nav-config.test.ts`

- [ ] **Step 3.1: Write the failing test**

Create the file:

```ts
import { describe, expect, it } from "vitest";
import { isNavActive } from "./portal-nav-config";

describe("isNavActive", () => {
  it("returns true for exact match", () => {
    expect(isNavActive("/cases", "/cases")).toBe(true);
  });

  it("returns true for child routes (prefix match with slash boundary)", () => {
    expect(isNavActive("/cases/abc123", "/cases")).toBe(true);
  });

  it("returns false for unrelated routes", () => {
    expect(isNavActive("/cases", "/dashboard")).toBe(false);
  });

  it("dashboard-suffixed hrefs only match exactly", () => {
    // The Dashboard tab must not light up on /cases, /invoices, etc.
    expect(isNavActive("/lawyer/cases", "/lawyer/dashboard")).toBe(false);
    expect(isNavActive("/dashboard", "/dashboard")).toBe(true);
  });

  it("does not match on a name-prefix without a slash boundary", () => {
    // /casesfoo must not match /cases
    expect(isNavActive("/casesfoo", "/cases")).toBe(false);
  });
});
```

- [ ] **Step 3.2: Run the test**

```bash
pnpm --filter @ligala/web test -- portal-nav-config
```

Expected: PASS (all 5 cases). The implementation already exists from Task 2 — this test is TDD-after-the-fact for a pure helper that's small enough that writing the test second is acceptable. The risk it locks down is regression on future edits.

- [ ] **Step 3.3: Commit**

```bash
git add apps/web/app/_components/portal-nav-config.test.ts
git commit -m "$(cat <<'EOF'
test(web): cover isNavActive edge cases

Locks in the active-route matching contract: exact match wins,
prefix match requires a slash boundary, dashboard-suffixed hrefs
only match exactly.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Build `SidebarBrand`

**Files:**
- Create: `apps/web/app/_components/sidebar-brand.tsx`

- [ ] **Step 4.1: Write the component**

Create the file:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function SidebarBrand({
  brandHref,
  roleTag,
}: {
  brandHref: string;
  roleTag: string;
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" tooltip="Ligala">
          <Link href={brandHref as never}>
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
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <div
          aria-hidden
          className="px-3 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--oxblood)] group-data-[collapsible=icon]:hidden"
        >
          · {roleTag}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

- [ ] **Step 4.2: Typecheck**

```bash
pnpm --filter @ligala/web typecheck
```

Expected: no errors. (Component isn't wired up yet — Task 7 will mount it.)

- [ ] **Step 4.3: Commit**

```bash
git add apps/web/app/_components/sidebar-brand.tsx
git commit -m "$(cat <<'EOF'
feat(web): add SidebarBrand with logo and role tag

Renders the existing Ligala logo + wordmark plus a small uppercase
role tag (CLIENT / LAWYER PORTAL / ADMIN) below it in oxblood.
The role tag hides automatically when the sidebar collapses to
icon mode.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Build `SidebarNav`

**Files:**
- Create: `apps/web/app/_components/sidebar-nav.tsx`

- [ ] **Step 5.1: Write the component**

Create the file:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { isNavActive, type NavGroup } from "./portal-nav-config";

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel
            className="font-serif italic text-[11px] tracking-[0.04em] text-[color:var(--muted-ink)]"
          >
            {group.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className="h-9 gap-2.5 pl-3 pr-2 text-[color:var(--muted-ink)] hover:bg-transparent hover:text-[color:var(--ink)] [&_svg]:opacity-70 hover:[&_svg]:opacity-100 data-[active=true]:[&_svg]:opacity-100 hover:[&>span:last-child]:underline hover:[&>span:last-child]:decoration-[color:var(--oxblood)] hover:[&>span:last-child]:underline-offset-4"
                    >
                      <Link href={item.href as never}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
```

A note on the long className: the shadcn primitive's default hover styling (background fill) doesn't fit the editorial direction. We override with `hover:bg-transparent` and instead apply a `var(--oxblood)` underline to the label span (`&>span:last-child`) and bring the icon opacity from 70% to 100%. The active state is handled by the `::before` rule from Task 1, plus `data-[active=true]:[&_svg]:opacity-100` to keep the icon vivid.

- [ ] **Step 5.2: Typecheck**

```bash
pnpm --filter @ligala/web typecheck
```

Expected: no errors.

- [ ] **Step 5.3: Commit**

```bash
git add apps/web/app/_components/sidebar-nav.tsx
git commit -m "$(cat <<'EOF'
feat(web): add SidebarNav with grouped items and editorial styling

Renders nav items grouped by section (Workspace / Discover / Growth /
Practice / Overview / People / Money / Records) with Fraunces italic
section labels. Active item gets the oxblood ::before bar set up in
Task 1; hover state is an oxblood underline on the label, no fill.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Build `SidebarUser`

**Files:**
- Create: `apps/web/app/_components/sidebar-user.tsx`

- [ ] **Step 6.1: Write the component**

Create the file:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function SidebarUser({
  userEmail,
  userName,
  userImage,
}: {
  userEmail: string;
  userName?: string | null;
  userImage?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const signingOut = pending || submitting;
  const displayName = userName?.trim() || userEmail.split("@")[0] || userEmail;
  const initial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    setSubmitting(true);
    try {
      await signOut();
    } finally {
      startTransition(() => {
        router.replace("/login");
        router.refresh();
        setSubmitting(false);
      });
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent data-[state=open]:bg-transparent [&_[data-slot=avatar]]:ring-1 [&_[data-slot=avatar]]:ring-transparent hover:[&_[data-slot=avatar]]:ring-[color:var(--oxblood)] data-[state=open]:[&_[data-slot=avatar]]:ring-[color:var(--oxblood)]"
            >
              <Avatar>
                {userImage ? <AvatarImage src={userImage} alt={displayName} /> : null}
                <AvatarFallback className="text-xs font-medium">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-[color:var(--ink)]">
                  {displayName}
                </span>
                <span className="truncate text-xs text-[color:var(--muted-ink)]">
                  {userEmail}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="end"
            sideOffset={4}
            className="w-56 rounded-lg"
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-sm">
                <Avatar>
                  {userImage ? <AvatarImage src={userImage} alt={displayName} /> : null}
                  <AvatarFallback className="text-xs font-medium">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={signingOut}
              onSelect={(event) => {
                event.preventDefault();
                void handleSignOut();
              }}
            >
              <LogOut />
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

- [ ] **Step 6.2: Typecheck**

```bash
pnpm --filter @ligala/web typecheck
```

Expected: no errors.

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/app/_components/sidebar-user.tsx
git commit -m "$(cat <<'EOF'
feat(web): add SidebarUser footer (identity + sign-out only)

Strips the footer dropdown to its essentials: a non-interactive
identity header and a sign-out item. Removes the disabled placeholder
items (Upgrade to Pro, Billing, Notifications) and the lawyer-specific
links (Subscription, Invoices, Discount codes) — all reachable via
sidebar nav. Hover state on the avatar is now a 1px oxblood ring.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Refactor `PortalShell` to compose the new components

**Files:**
- Modify: `apps/web/app/_components/portal-shell.tsx` (full rewrite)

- [ ] **Step 7.1: Replace the file**

Overwrite the entire file with:

```tsx
"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarNav } from "./sidebar-nav";
import { SidebarUser } from "./sidebar-user";
import {
  getPortalConfig,
  SEGMENT_LABELS,
  type Variant,
} from "./portal-nav-config";

function looksLikeId(segment: string): boolean {
  return /^[a-z0-9]{16,}$/i.test(segment) || /^[0-9]+$/.test(segment);
}

function labelForSegment(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment]!;
  if (looksLikeId(segment)) return "Detail";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function buildCrumbs(
  pathname: string,
): Array<{ href: string; label: string; isLast: boolean }> {
  const all = pathname.split("/").filter(Boolean);
  // Strip the role prefix (`lawyer`, `admin`) — the sidebar already conveys role.
  const start = all[0] === "lawyer" || all[0] === "admin" ? 1 : 0;
  const rolePrefix = start ? "/" + all[0] : "";
  const tail = all.slice(start);
  return tail.map((seg, i) => ({
    href: rolePrefix + "/" + tail.slice(0, i + 1).join("/"),
    label: labelForSegment(seg),
    isLast: i === tail.length - 1,
  }));
}

export function PortalShell({
  variant,
  userEmail,
  userName,
  userImage,
  children,
}: {
  variant: Variant;
  userEmail: string;
  userName?: string | null;
  userImage?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const config = getPortalConfig(variant);

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarBrand brandHref={config.brandHref} roleTag={config.roleTag} />
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarNav groups={config.groups} />
          </SidebarContent>
          <SidebarSeparator />
          <SidebarFooter>
            <SidebarUser
              userEmail={userEmail}
              userName={userName}
              userImage={userImage}
            />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b border-[color:var(--rule)] px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-2 !h-4" />
            <Breadcrumb>
              <BreadcrumbList className="text-[13px]">
                {buildCrumbs(pathname).map((crumb, i, arr) => (
                  <Fragment key={crumb.href}>
                    <BreadcrumbItem>
                      {crumb.isLast ? (
                        <BreadcrumbPage className="font-serif italic text-[color:var(--ink)]">
                          {crumb.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild className="text-[color:var(--muted-ink)]">
                          <Link href={crumb.href as never}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {i < arr.length - 1 && <BreadcrumbSeparator />}
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
```

- [ ] **Step 7.2: Typecheck**

```bash
pnpm --filter @ligala/web typecheck
```

Expected: no errors. Common pitfalls if you see one:
- "Cannot find module './sidebar-brand'" → Task 4 wasn't committed.
- "Property 'roleTag' does not exist on type 'PortalConfig | undefined'" → you accidentally indexed `PORTAL_CONFIG[variant]` instead of calling `getPortalConfig(variant)`. The total function avoids the strict-index complaint.

- [ ] **Step 7.3: Lint**

```bash
pnpm --filter @ligala/web lint
```

Expected: no errors or warnings.

- [ ] **Step 7.4: Commit**

```bash
git add apps/web/app/_components/portal-shell.tsx
git commit -m "$(cat <<'EOF'
refactor(web): slim PortalShell to a composer over focused components

PortalShell now delegates to SidebarBrand / SidebarNav / SidebarUser
and renders the page header (trigger + breadcrumbs). The last crumb
renders in Fraunces italic to tie the header back to the sidebar's
section labels. Sidebar width bumps to 17rem to comfortably fit
"Find a lawyer" and "Discount codes" on a single line.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Manual visual verification

**Files:** none (verification only)

- [ ] **Step 8.1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 8.2: Verify each portal in the browser**

For each of the following routes, open in a browser and check the checklist below:

| Role   | Home route             | Deep route                             |
|--------|------------------------|----------------------------------------|
| client | `/dashboard`           | `/cases` (any case detail if seeded)   |
| lawyer | `/lawyer/dashboard`    | `/lawyer/cases`                        |
| admin  | `/admin/dashboard`     | `/admin/users`                         |

**Per route, verify:**

- [ ] Logo renders (SVG, no broken image).
- [ ] Role tag (`· CLIENT` / `· LAWYER PORTAL` / `· ADMIN`) shows under the logo in oxblood uppercase.
- [ ] Section labels (Workspace / Discover / Growth / Practice / Overview / People / Money / Records) render in Fraunces italic.
- [ ] Active item has the 2px oxblood bar at the left edge.
- [ ] Inactive items show in muted ink; icons at 70% opacity.
- [ ] Hover on an inactive item: oxblood underline appears under the label, no background fill.
- [ ] Sidebar background is the warm paper tone (`#fbf8f3`-ish via oklch).
- [ ] Footer dropdown opens: shows identity header + only one item ("Sign out"). No "Upgrade to Pro", no "Billing", no "Notifications", no lawyer-specific links.
- [ ] Sign-out works: clicking "Sign out" redirects to `/login`.
- [ ] Header above content: `h-14`, last breadcrumb in Fraunces italic, intermediate crumbs in muted ink.

- [ ] **Step 8.3: Verify collapsed-icon mode**

Click the `SidebarTrigger` icon (or press `Cmd/Ctrl+B`).

- [ ] Section labels disappear.
- [ ] Role tag disappears.
- [ ] Active item's oxblood bar still visible.
- [ ] Tooltips appear on hover over items.
- [ ] Logo collapses to just `/ligala-logo.svg` (text mark hidden).

- [ ] **Step 8.4: Verify mobile sheet**

Open Chrome DevTools, switch to mobile viewport (e.g., iPhone 14 width). The sidebar collapses off-canvas.

- [ ] Tap the trigger — sidebar slides in as a sheet.
- [ ] Sidebar inside the sheet is fully expanded (not in icon mode).
- [ ] Tapping a nav item navigates and closes the sheet.

- [ ] **Step 8.5: Run unit tests**

```bash
pnpm --filter @ligala/web test
```

Expected: `isNavActive` suite passes, 5/5.

- [ ] **Step 8.6: Run full typecheck and lint across the workspace**

```bash
pnpm typecheck && pnpm lint
```

Expected: no errors. (Other packages should be unaffected, but the typecheck graph runs through them so this verifies no accidental shared-type break.)

- [ ] **Step 8.7: If everything passes, no commit needed**

Verification only. If any visual issue surfaces, treat it as a follow-up edit, fix in the relevant file, and commit with a `fix(web):` prefix.

---

## Self-review against spec

This plan covers every section of the spec:

| Spec section          | Implementing task(s) |
|-----------------------|----------------------|
| Type system           | Task 1 (Step 1.1, 1.3) |
| Palette               | Task 1 (Step 1.2) |
| States (active/hover/focus) | Task 1 (Step 1.4), Task 5 |
| Width                 | Task 7 (`--sidebar-width: 17rem`) |
| Vertical structure    | Tasks 4, 5, 6, 7 |
| Nav item geometry     | Task 5 (className on `SidebarMenuButton`) |
| Collapsed (icon) state | Task 4 (role tag hide), Task 5 (group label hide via primitive) |
| Mobile sheet          | Inherited from shadcn primitive — no code; verified in Task 8.4 |
| Header bar            | Task 7 |
| Per-role nav config   | Task 2 |
| Active-state matching | Task 2, locked in by Task 3 |
| Footer dropdown       | Task 6 |
| Testing approach      | Task 3 (unit), Task 8 (manual checklist + type/lint) |

No placeholders, no TBDs, no "implement later" steps. Each step shows the code or command it expects you to run, with expected output.
