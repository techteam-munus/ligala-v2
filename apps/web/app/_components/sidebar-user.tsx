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
