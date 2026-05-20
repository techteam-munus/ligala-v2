import type { ReactNode } from "react";

// Phase 1 will guard this group with a Better Auth session check + role=lawyer.
export default function LawyerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
