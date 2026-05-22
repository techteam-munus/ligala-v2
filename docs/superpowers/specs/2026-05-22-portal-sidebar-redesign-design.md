# Portal sidebar redesign — design spec

**Date:** 2026-05-22
**Scope:** Visual refresh of the portal sidebar shared by all three user roles (client, lawyer, admin).
**Out of scope:** Functional changes to navigation structure beyond grouping; dark mode; new features (notifications, search, workspace switcher); extraction to `@ligala/ui`.

## Context

The portal sidebar lives at `apps/web/app/_components/portal-shell.tsx` (389 lines) and is shared by the three role-group layouts (`(client)`, `(lawyer)`, `(admin)`). It uses shadcn's `Sidebar` primitive (`apps/web/components/ui/sidebar.tsx`) and currently renders with default shadcn styling on Inter. The current implementation is functionally complete — collapsible icon mode, mobile sheet behavior, user dropdown, breadcrumbs — but the look reads as generic.

This redesign is **visual only**: same nav items, same routes, same Better Auth + session model, same shadcn primitive underneath. The component tree is also split into smaller, focused files as part of the work since `portal-shell.tsx` is large enough that future edits would be friction-prone.

## Design direction

**Editorial — serif + restrained color.** Display serif for section labels and headings, clean variable sans for nav, generous whitespace, single warm accent, hairline rules. Reads as a modern law firm meets a literary magazine — credible to professionals without feeling stiff.

## Visual language

### Type system

Loaded via `next/font/google` in `apps/web/app/layout.tsx`, exposed as CSS variables on `<html>`:

| Variable      | Family       | Used for                                                                  |
|---------------|--------------|---------------------------------------------------------------------------|
| `--font-serif` | Fraunces    | Section labels in nav (italic, micro), in-app display headings, breadcrumb tail. |
| `--font-sans`  | Geist Sans  | Nav items, body, UI chrome. Replaces Inter site-wide.                     |

Mono numerals (IDs, invoice numbers) stay on whatever system mono the existing code already uses — no mono font is added as part of this redesign.

The wordmark continues to render via the existing `/ligala-text.svg` — not retyped in Fraunces.

The Inter import in `apps/web/app/layout.tsx` is removed.

### Palette

Added to `apps/web/app/globals.css` as design tokens:

| Token         | Value     | Role                                                    |
|---------------|-----------|---------------------------------------------------------|
| `--paper`     | `#fbf8f3` | Warm off-white. Sidebar surface.                        |
| `--ink`       | `#1a1714` | Deep warm-black. Primary text.                          |
| `--muted-ink` | `#6b6258` | Inactive nav text, breadcrumb intermediate crumbs.      |
| `--oxblood`   | `#7a1d2c` | Active state bar, focus ring, role tag, avatar hover ring. |
| `--rule`      | `#e8e1d4` | Hairline rules separating header / content / footer.    |

These tokens are mapped into shadcn's existing `--sidebar*` CSS variables so the primitive inherits them without component-level overrides:

```css
:root {
  --sidebar: var(--paper);
  --sidebar-foreground: var(--ink);
  --sidebar-border: var(--rule);
  --sidebar-accent: transparent;          /* no fill on active */
  --sidebar-accent-foreground: var(--ink);
  --sidebar-ring: var(--oxblood);
}
```

The page body (`SidebarInset` area) keeps its existing near-white shadcn background — the paper-tinted sidebar establishes contrast against it without a hard divider.

### States

- **Active**: 2px oxblood bar flush to the left edge of the row (rendered via `::before` pseudo-element on `[data-sidebar="menu-button"][data-active="true"]`), label at `font-weight: 500`, icon at full opacity. No background fill.
- **Hover**: 1px oxblood underline under the label text, no background. Inactive icons go from 70% opacity to 100%.
- **Focus**: oxblood ring (inherited from `--sidebar-ring`).

## Layout & composition

### Width

`--sidebar-width: 17rem` (up from 16rem). Collapsed icon mode unchanged at `3rem`.

### Vertical structure

```
┌────────────────────────────────┐
│  px-5 pt-5 pb-3                │
│  [ligala-logo.svg + text.svg]  │  brand row, h-7
│  · CLIENT                      │  role tag: Geist Sans 10px,
│                                │  oxblood, tracking-[0.18em], uppercase
├────────────────────────────────┤  --rule hairline
│  pt-4 px-3                     │
│                                │
│  Workspace            (italic) │  section label: Fraunces italic 11px,
│   Dashboard                    │  muted-ink, tracking-[0.04em], pb-1.5
│ │ Cases                        │  ← active item, oxblood ::before bar
│   Invoices                     │
│   Profile                      │
│                                │
│  Discover             (italic) │  section gap = 16px
│   Find a lawyer                │
│   IBP chapters                 │
│                                │
├────────────────────────────────┤  --rule hairline
│  px-3 py-3                     │
│  (JR)  Juan Reyes        ⌄     │  footer: avatar 28px, name 13px Geist 500,
│        juan@…                  │  email 11px muted-ink
└────────────────────────────────┘
```

### Nav item geometry

- Row: `h-9`, `gap-2.5`, `pl-3 pr-2`.
- Icon: 16px (Lucide, unchanged set per role).
- Active `::before` bar: `position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; background: var(--oxblood);`.

### Collapsed (icon) state

- Section labels (Fraunces italic) hide via `group-data-[collapsible=icon]:hidden`.
- Role tag hides.
- Active oxblood bar still renders, flush against the 48px-wide icon column — appears as a tick mark in the margin.
- Logo collapses to `/ligala-logo.svg` only (no text mark), centered.
- User footer collapses to just the avatar.

### Mobile (sheet)

- Sheet behavior inherited from shadcn primitive — slides in from the left over content.
- Inside the sheet, the sidebar renders in full expanded form (no collapsed mode on mobile).
- Existing `SidebarTrigger` in the page header opens it.

### Header bar above content

`SidebarInset`'s `<header>`:
- Height bumps `h-12` → `h-14`.
- Existing structure preserved: `SidebarTrigger` + vertical separator + breadcrumbs.
- Breadcrumbs render in Geist Sans 13px, intermediate crumbs in `text-muted-ink`.
- Last crumb (current page) renders in Fraunces italic — ties the header back to sidebar section labels.

## Per-role nav config

Nav data moves to a new module `apps/web/app/_components/portal-nav-config.ts` as plain typed data. All existing items are preserved, just reorganized into groups.

### Client (`brandHref: /dashboard`, `roleTag: CLIENT`)

- **Workspace**: Dashboard, Cases, Invoices, Profile
- **Discover**: Find a lawyer, IBP chapters

### Lawyer (`brandHref: /lawyer/dashboard`, `roleTag: LAWYER PORTAL`)

- **Workspace**: Dashboard, Cases
- **Growth**: Referrals, Referral links
- **Billing**: Invoices, Discount codes
- **Practice**: Public profile, Office, KYC

### Admin (`brandHref: /admin/dashboard`, `roleTag: ADMIN`)

- **Overview**: Dashboard
- **People**: Users, KYC inbox
- **Money**: Invoices, Discount codes, Referrals
- **Records**: IBP lawyers, Audit log

### Type shape

```ts
type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };
type PortalConfig = { roleTag: string; brandHref: string; groups: NavGroup[] };

export const PORTAL_CONFIG: Record<"client"|"lawyer"|"admin", PortalConfig>;
export const SEGMENT_LABELS: Record<string, string>;
export function isNavActive(pathname: string, href: string): boolean;
```

### Active-state matching

Behavior unchanged from current `isActive` in `portal-shell.tsx`:
- Exact match wins.
- Otherwise `pathname.startsWith(href + "/")`.
- Routes ending in `/dashboard` never match a non-dashboard child route.

Moves out of `portal-shell.tsx` into `portal-nav-config.ts` as a pure function. Gets a vitest spec — currently has no test coverage.

## Footer dropdown

Stripped to identity confirmation + sign-out only. Same for all three roles.

```
┌────────────────────────────┐
│  (JR)  Juan Reyes          │  identity header, non-interactive
│        juan@example.com    │
├────────────────────────────┤
│   ↪  Sign out              │  only action
└────────────────────────────┘
```

### Removed from current dropdown

- "Upgrade to Pro" (disabled placeholder, no such feature)
- "Billing" (disabled placeholder for client/admin)
- "Notifications" (disabled placeholder)
- Lawyer's Subscription / Invoices / Discount codes (already in sidebar — duplication)

### Always-visible footer row (above the dropdown)

Same shape — avatar + name + email + chevron. Only change: hover state is a 1px oxblood ring on the avatar instead of an accent-fill background.

## File plan

All paths relative to `apps/web/`.

### New files

| Path                                        | Purpose                                                                        | Approx LOC |
|---------------------------------------------|--------------------------------------------------------------------------------|-----------:|
| `app/_components/portal-nav-config.ts`      | Typed nav data + `isNavActive` + `SEGMENT_LABELS`. No React.                  |        ~80 |
| `app/_components/portal-nav-config.test.ts` | Vitest spec for `isNavActive`. Covers exact, prefix, dashboard guard.         |        ~40 |
| `app/_components/sidebar-brand.tsx`         | Logo row + role tag. Uses `SidebarMenuButton size="lg"` for collapse inheritance. |        ~30 |
| `app/_components/sidebar-nav.tsx`           | Grouped nav. Reads `groups`, calls `isNavActive`, renders section labels + items. |        ~40 |
| `app/_components/sidebar-user.tsx`          | Footer dropdown (identity + sign-out). Owns `signOut` + transition state.     |        ~50 |

### Modified files

**`app/_components/portal-shell.tsx`** — Becomes a thin composer (~60 lines):

```ts
export function PortalShell({ variant, userEmail, userName, userImage, children }) {
  const config = PORTAL_CONFIG[variant];
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader><SidebarBrand brandHref={config.brandHref} roleTag={config.roleTag} /></SidebarHeader>
          <SidebarSeparator />
          <SidebarContent><SidebarNav groups={config.groups} /></SidebarContent>
          <SidebarSeparator />
          <SidebarFooter><SidebarUser userName={userName} userEmail={userEmail} userImage={userImage} /></SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b border-[color:var(--rule)] px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-2 !h-4" />
            <Breadcrumb>{/* buildCrumbs(...) — stays inline, ~20 lines */}</Breadcrumb>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
```

Breadcrumb helpers (`buildCrumbs`, `looksLikeId`, `labelForSegment`) stay inline in `portal-shell.tsx`. `SEGMENT_LABELS` moves to the config module since it's nav-adjacent.

**`app/layout.tsx`** — Replace Inter with Fraunces + Geist Sans:

```ts
import { Fraunces, Geist } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

// ...
<html lang="en" className={cn("font-sans", fraunces.variable, geist.variable)}>
```

**`app/globals.css`** — Add tokens, map into shadcn sidebar variables, add active-state `::before` rule. See **Palette** and **States** sections above for exact CSS.

### Removed

- `Inter` font import in `app/layout.tsx`.
- `Sparkles`, `Bell`, `CreditCard`, `TicketPercent` icon imports from `portal-shell.tsx` (only from this file — they may still be used elsewhere).
- Lawyer-specific dropdown items + disabled placeholder items in the footer dropdown.

## Testing approach

### Unit

`portal-nav-config.test.ts` covers `isNavActive`:
- `isNavActive("/cases", "/cases")` → true
- `isNavActive("/cases/abc123", "/cases")` → true
- `isNavActive("/cases", "/dashboard")` → false
- `isNavActive("/lawyer/dashboard", "/dashboard")` → false (dashboard guard)
- `isNavActive("/casesfoo", "/cases")` → false (prefix-with-slash boundary)

### Manual visual checklist

For each of `client`, `lawyer`, `admin`:
- [ ] `/dashboard` (or role equivalent) renders, correct group is expanded, correct item shows oxblood bar
- [ ] Deep route (e.g., `/cases/[id]`) keeps "Cases" active
- [ ] Role tag shows under logo with correct value
- [ ] Section labels render in Fraunces italic
- [ ] Hover state on inactive item shows oxblood underline, no background
- [ ] Footer dropdown opens, shows only identity + sign-out
- [ ] Sign-out flow still works (redirects to /login)
- [ ] Collapsed-icon mode: section labels hidden, role tag hidden, active bar still visible
- [ ] Mobile: sheet opens on trigger, full sidebar inside

### Type/lint

```bash
pnpm --filter @ligala/web typecheck
pnpm --filter @ligala/web lint
```

Both must pass.

## Out of scope (recorded so we don't re-litigate)

- **Dark mode.** Deferred. Token structure leaves room — light-only ships now.
- **Notification badges, search bar, workspace switcher.** Not requested.
- **`@ligala/ui` extraction.** Per CLAUDE.md, only promote when a second app needs it.
- **Non-portal page chrome.** Marketing pages, login, public directory unchanged.
- **Functional changes to nav** beyond grouping (no items added, removed, or rerouted).
