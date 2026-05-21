import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { roleHome } from "@/lib/role";
import { PortalShell } from "@/app/_components/portal-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect(roleHome(session.user.role));
  return (
    <PortalShell
      variant="admin"
      userEmail={session.user.email}
      userName={session.user.name}
      userImage={session.user.image}
    >
      {children}
    </PortalShell>
  );
}
