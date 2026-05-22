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
