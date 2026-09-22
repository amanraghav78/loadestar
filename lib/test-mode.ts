import { env } from "@/lib/env";

/**
 * End-to-end test mode: password sign-in (lib/auth.ts) and the in-process file
 * store (lib/storage) instead of Google and Cloudflare.
 *
 * The suite runs against a production build, so NODE_ENV can't be the guard.
 * It takes the explicit flag *and* an environment that isn't the live
 * deployment: on Vercel production `VERCEL_ENV` is "production", so setting the
 * flag there still does nothing.
 */
export const testModeEnabled = env.E2E_TEST_AUTH === "1" && process.env.VERCEL_ENV !== "production";
