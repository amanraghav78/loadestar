import { NextResponse, type NextRequest } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth, authEnabled } from "@/lib/auth";

import { clientIp, rateLimit } from "@/lib/ratelimit";

// Built on first use: with accounts unconfigured there is no auth instance to
// hand it, and these routes answer 404 instead.
let handlers: ReturnType<typeof toNextJsHandler> | null = null;
const routes = () => (handlers ??= toNextJsHandler(auth));

const off = () => new NextResponse("Not found", { status: 404 });

/** Sign-in, sign-out and account deletion all arrive as POSTs, so throttle here. */
export async function POST(request: NextRequest) {
  if (!authEnabled) return off();
  if (!(await rateLimit("auth", clientIp(request.headers)))) {
    return new NextResponse("Too many attempts. Try again in a minute.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
  return routes().POST(request);
}

/** Google redirects back here; rate limiting a callback would break the sign-in. */
export async function GET(request: NextRequest) {
  if (!authEnabled) return off();
  return routes().GET(request);
}
