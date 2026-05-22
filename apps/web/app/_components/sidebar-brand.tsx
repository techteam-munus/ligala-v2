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
    <>
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
      <div className="px-3 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--oxblood)] group-data-[collapsible=icon]:hidden">
        <span aria-hidden>·</span> {roleTag}
      </div>
    </>
  );
}
