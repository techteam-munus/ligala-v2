import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { roleHome } from "@/lib/role";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "client") redirect(roleHome(session.user.role));
  return <>{children}</>;
}
