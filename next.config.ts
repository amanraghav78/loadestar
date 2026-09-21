import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const isDev = process.env.NODE_ENV !== "production";

// Next injects inline bootstrap scripts, so script-src needs 'unsafe-inline'
// unless every page opts into per-request nonces (which disables static
// rendering). Everything else is locked to our own origin plus the
// analytics and error-reporting endpoints we actually use.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://vitals.vercel-insights.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  // A parent folder has its own lockfile; pin the workspace root to this project.
  turbopack: { root: process.cwd() },
  typedRoutes: false,
  images: {
    // Company logos are entered by admins only.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Only upload source maps when a Sentry token is configured.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
