import * as Sentry from "@sentry/aws-serverless";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
  });

  initialized = true;
}

export function captureException(err: unknown, extra?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(err, extra ? { extra } : undefined);
}

export { Sentry };
