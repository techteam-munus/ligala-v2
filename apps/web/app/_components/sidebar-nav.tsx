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
