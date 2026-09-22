import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cacheLife } from "next/cache";
import { auth, authEnabled } from "@/lib/auth";

export type SessionUser = { id: string; name: string; email: string; image: string | null };

/**
 * The signed-in candidate, for rendering only.
 *
 * `use cache: private` is what lets this read the request: the result stays in
 * the caller's browser for the cache lifetime and is never written to a server
 * cache shared between visitors. A plain `use cache` would throw here, and the
 * job data in lib/queries.ts — which is shared — must never learn about users.
 *
 * Callers must sit behind a <Suspense> boundary; that is a build error otherwise.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  "use cache: private";
  cacheLife({ stale: 60 });

  if (!authEnabled) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };
}

/**
 * The signed-in candidate, for route handlers and server actions, where an
 * authorization answer must never come from a cache. Every action and handler
 * calls this itself rather than trusting the page that rendered the form.
 */
export async function getUser(): Promise<SessionUser | null> {
  if (!authEnabled) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };
}

/** Throws for route handlers that should answer 401. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Sign in to continue");
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** For pages: sends a signed-out visitor to sign in, remembering where they were. */
export async function requireUserPage(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}
