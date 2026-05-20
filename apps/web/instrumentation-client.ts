import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    replaysOnErrorSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR ?? 0),
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
  });
}
