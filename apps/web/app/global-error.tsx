"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    } else {
      console.error("[web] unhandled error", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-start justify-center gap-4 px-6">
          <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground">
            We hit an unexpected error. The team has been notified.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm shadow-sm hover:bg-muted"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
