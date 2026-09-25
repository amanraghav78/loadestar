import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { site } from "@/lib/site";
import { testModeEnabled } from "@/lib/test-mode";

/**
 * Candidates sign in with Google; the session lives in our own database.
 *
 * Accounts stay switched off until the credentials and a secret are
 * configured, and nothing is constructed in that case — Better Auth refuses to
 * start without a secret, which would otherwise take the whole site down.
 */
export const accountsEnabled = Boolean(env.BETTER_AUTH_SECRET && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Password sign-in exists only for the end-to-end suite. See lib/test-mode.ts. */
export const testAuthEnabled = testModeEnabled && Boolean(env.BETTER_AUTH_SECRET);

/** Whether there is a working auth instance at all (sign-in UI, or the test hook). */
export const authEnabled = accountsEnabled || testAuthEnabled;

/**
 * Where "Post a job" goes. The /employers pages 404 without accounts, so until
 * they are switched on employers are sent to the submission form instead.
 */
export const postJobHref = authEnabled ? "/employers/post" : site.postRoleFormUrl;

function createAuth() {
  return betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    baseURL: env.BETTER_AUTH_URL ?? site.url,
    secret: env.BETTER_AUTH_SECRET,
    // Requests from anywhere else are refused. The test suite serves a
    // production build on its own port, which is otherwise not the site URL.
    trustedOrigins: testModeEnabled ? ["http://localhost:3100", "http://127.0.0.1:3100"] : [],
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {},
    emailAndPassword: { enabled: testAuthEnabled },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Signed cookie carrying the session for a few minutes, so reading the
      // current user on a page render usually costs no database round trip.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: { deleteUser: { enabled: true } },
    // Must stay last: it lets server actions set the session cookie.
    plugins: [nextCookies()],
  });
}

/** Touching this without configuration is a bug, not something to paper over. */
function unavailable(): ReturnType<typeof createAuth> {
  return new Proxy({} as ReturnType<typeof createAuth>, {
    get() {
      throw new Error("Candidate accounts are not configured: set BETTER_AUTH_SECRET and GOOGLE_CLIENT_ID/SECRET.");
    },
  });
}

export const auth = authEnabled ? createAuth() : unavailable();
