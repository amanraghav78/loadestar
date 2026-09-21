import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      enabled: Boolean(process.env.SENTRY_DSN),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0.05,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
