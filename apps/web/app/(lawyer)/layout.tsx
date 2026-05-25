import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { roleHome } from "@/lib/role";
import { PortalShell } from "@/app/_components/portal-shell";
import { SubscriptionBanner } from "./_components/subscription-banner";

export default async function LawyerLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  // Clear a stale cookie via /logout (not a bare /login redirect, which the
  // edge middleware bounces straight back — an infinite loop). See app/logout.
  if (!session) redirect("/logout");
  if (session.user.role !== "lawyer") redirect(roleHome(session.user.role));
  return (
    <PortalShell
      variant="lawyer"
      userEmail={session.user.email}
      userName={session.user.name}
      userImage={session.user.image}
    >
      <SubscriptionBanner />
      {children}
    </PortalShell>
  );
}
