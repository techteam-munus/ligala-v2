import type { ReactNode } from "react";

// Phase 1 will guard this group with a Better Auth session check + role=admin.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
