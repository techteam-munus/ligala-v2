import type { ReactNode } from "react";

// Phase 1 will guard this group with a Better Auth session check + role=client.
export default function ClientLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
