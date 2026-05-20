import type * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: typeof Sentry.captureRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
};
