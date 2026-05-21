"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  Briefcase,
  Building,
  Building2,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Link2,
  Receipt,
  Scale,
  ScrollText,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const ACCOUNT_HREF: Record<Variant, string | null> = {
  client: "/profile",
  lawyer: "/lawyer/profile",
  admin: null,
};

type Variant = "client" | "lawyer" | "admin";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: Record<Variant, { brandHref: string; items: NavItem[] }> = {
  client: {
    brandHref: "/dashboard",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/cases", label: "Cases", icon: Briefcase },
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/profile", label: "Profile", icon: User },
      { href: "/lawyers", label: "Find a lawyer", icon: Search },
      { href: "/chapters", label: "IBP chapters", icon: Building2 },
    ],
  },
  lawyer: {
    brandHref: "/lawyer/dashboard",
    items: [
      { href: "/lawyer/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/lawyer/cases", label: "Cases", icon: Briefcase },
      { href: "/lawyer/invoices", label: "Invoices", icon: Receipt },
      { href: "/lawyer/referrals", label: "Referrals", icon: Share2 },
      { href: "/lawyer/referral-links", label: "Referral links", icon: Link2 },
      {
        href: "/lawyer/discount-codes",
        label: "Discount codes",
        icon: TicketPercent,
      },
      { href: "/lawyer/kyc", label: "KYC", icon: ShieldCheck },
      { href: "/lawyer/profile", label: "Public profile", icon: User },
      { href: "/lawyer/office", label: "Office", icon: Building },
    ],
  },
  admin: {
    brandHref: "/admin/dashboard",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/kyc", label: "KYC inbox", icon: ShieldCheck },
      {
        href: "/admin/discount-codes",
        label: "Discount codes",
        icon: TicketPercent,
      },
      { href: "/admin/invoices", label: "Invoices", icon: Receipt },
      { href: "/admin/referrals", label: "Referrals", icon: Share2 },
      { href: "/admin/ibp-lawyers", label: "IBP lawyers", icon: Scale },
      { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
    ],
  },
};

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href.endsWith("/dashboard")) return false;
  return pathname.startsWith(href + "/");
}

const SEGMENT_LABELS: Record<string, string> = {
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
  new: "New",
};

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const signingOut = pending || submitting;
  const { brandHref, items } = NAV[variant];
  const accountHref = ACCOUNT_HREF[variant];
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
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
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
            </SidebarMenu>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
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
          </SidebarContent>
          <SidebarSeparator />
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                      <Avatar>
                        {userImage ? <AvatarImage src={userImage} alt={displayName} /> : null}
                        <AvatarFallback className="text-xs font-medium">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                      <span className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">
                          {displayName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
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
                          <span className="truncate font-medium">
                            {displayName}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {userEmail}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                      <Sparkles />
                      Upgrade to Pro
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {accountHref ? (
                      <DropdownMenuItem asChild>
                        <Link href={accountHref as never}>
                          <BadgeCheck />
                          Account
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem disabled>
                        <BadgeCheck />
                        Account
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem disabled>
                      <CreditCard />
                      Billing
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <Bell />
                      Notifications
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={signingOut}
                      onSelect={(event) => {
                        event.preventDefault();
                        void handleSignOut();
                      }}
                    >
                      <LogOut />
                      {signingOut ? "Signing out…" : "Log out"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b border-border/60 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-2 !h-4 mt-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {buildCrumbs(pathname).map((crumb, i, arr) => (
                  <Fragment key={crumb.href}>
                    <BreadcrumbItem>
                      {crumb.isLast ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
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
