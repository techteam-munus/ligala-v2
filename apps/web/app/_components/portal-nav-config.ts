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
