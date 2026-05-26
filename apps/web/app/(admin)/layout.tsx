import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { resolveAvatarUrl } from "@/lib/avatar";
import { roleHome } from "@/lib/role";
import { PortalShell } from "@/app/_components/portal-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  // Clear a stale cookie via /logout (not a bare /login redirect, which the
  // edge middleware bounces straight back — an infinite loop). See app/logout.
  if (!session) redirect("/logout");
  // Block until the email is verified (6-digit code). Routes to the fix, not a
  // dead end; the verify page reads the email from the session and resends.
  if (!session.user.emailVerified) redirect("/verify-email?send=1");
  if (session.user.role !== "admin") redirect(roleHome(session.user.role));
  const userImage = await resolveAvatarUrl(session.user.image);
  return (
    <PortalShell
      variant="admin"
      userEmail={session.user.email}
      userName={session.user.name}
      userImage={userImage}
    >
      {children}
    </PortalShell>
  );
}
