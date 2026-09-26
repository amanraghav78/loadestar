/**
 * The browser Sentry SDK, loaded on demand.
 *
 * Imported statically, the SDK (with tracing) was scope-hoisted into the same
 * chunk as React and the router, about a third of the JavaScript every page
 * has to evaluate before it hydrates. Here it is a separate chunk that loads
 * once the page has finished loading and the main thread is idle, or right
 * away when there is an error to report. Without a DSN nothing loads at all.
 *
 * The trade-off: an error thrown before the SDK arrives is caught by the
 * boundaries (app/error.tsx, app/global-error.tsx), which report through
 * `captureError` and so still reach Sentry; only uncaught errors from the first
 * second or two of a page's life go unreported.
 */
type SentrySdk = typeof import("@sentry/nextjs");

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

let sdk: SentrySdk | null = null;
let loading: Promise<SentrySdk> | null = null;

export function loadSentry(): Promise<SentrySdk> | null {
  if (!dsn) return null;
  loading ??= import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0.05,
    });
    sdk = Sentry;
    return Sentry;
  });
  return loading;
}

/** Starts loading the SDK once the page has loaded and the browser is idle. */
export function loadSentryWhenIdle() {
  if (!dsn || typeof window === "undefined") return;
  const start = () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(() => void loadSentry(), { timeout: 4000 });
    else setTimeout(() => void loadSentry(), 1000);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

/** Sends an error to Sentry, loading the SDK first if it isn't here yet. */
export function captureError(error: unknown) {
  void loadSentry()
    ?.then((Sentry) => Sentry.captureException(error))
    .catch(() => {});
}

/** Navigation spans, once the SDK is loaded; navigations before that go untraced. */
export function captureRouterTransitionStart(...args: Parameters<SentrySdk["captureRouterTransitionStart"]>) {
  sdk?.captureRouterTransitionStart(...args);
}
