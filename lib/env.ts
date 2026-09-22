import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    // Upstash is optional in development; rate limiting is skipped without it.
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    // Names injected by the Vercel Marketplace Upstash integration.
    KV_REST_API_URL: z.url().optional(),
    KV_REST_API_TOKEN: z.string().min(1).optional(),
    ADMIN_USER: z.string().min(1),
    ADMIN_PASS: z.string().min(12, "Use a long admin password"),
    CRON_SECRET: z.string().min(16),
    SENTRY_DSN: z.url().optional(),
    // Candidate accounts. All optional: without them the site runs exactly as
    // it did before, with sign-in hidden (see `accountsEnabled` in lib/auth.ts).
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    BETTER_AUTH_URL: z.url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    // Resume storage (Cloudflare R2). Without them uploads are turned off, and
    // tests use the in-memory driver in lib/storage/index.ts.
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1).optional(),
    /// Enables a password sign-in route for end-to-end tests. Never set in production.
    E2E_TEST_AUTH: z.literal("1").optional(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_POST_ROLE_FORM_URL: z.url().default("https://forms.gle/your-form-id"),
    NEXT_PUBLIC_CONTACT_EMAIL: z.email().default("hello@lodestar.jobs"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_POST_ROLE_FORM_URL: process.env.NEXT_PUBLIC_POST_ROLE_FORM_URL,
    NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  },
  // Lets lint/typecheck run in CI without secrets.
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
  emptyStringAsUndefined: true,
});
