import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    // Upstash is optional in development; rate limiting is skipped without it.
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    ADMIN_USER: z.string().min(1),
    ADMIN_PASS: z.string().min(12, "Use a long admin password"),
    CRON_SECRET: z.string().min(16),
    SENTRY_DSN: z.url().optional(),
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
