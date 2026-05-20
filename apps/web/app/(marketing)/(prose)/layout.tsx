import type { ReactNode } from "react";

export default function ProseLayout({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <div className="prose-ligala">{children}</div>
    </article>
  );
}
