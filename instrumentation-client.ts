import { captureRouterTransitionStart, loadSentryWhenIdle } from "./lib/sentry-client";

// The SDK is kept off the critical path: see lib/sentry-client.ts.
loadSentryWhenIdle();

export const onRouterTransitionStart = captureRouterTransitionStart;
