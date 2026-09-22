import { after, NextResponse, type NextRequest } from "next/server";
import { auth, authEnabled } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const ID = /^[a-z0-9]{10,40}$/i;

/**
 * Outbound "Apply" redirect. Records an anonymous click, then 302s to the
 * company's own application page. The destination always comes from the
 * database, never from the request, so this cannot be used as an open redirect.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/apply/[jobId]">) {
  const { jobId } = await ctx.params;
  if (!ID.test(jobId)) return NextResponse.redirect(new URL("/jobs", request.url));

  const allowed = await rateLimit("apply", clientIp(request.headers));
  if (!allowed) {
    return new NextResponse("Too many requests. Please wait a minute and try again.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { slug: true, status: true, applyUrl: true },
  });

  if (!job) return NextResponse.redirect(new URL("/jobs", request.url));
  if (job.status !== "ACTIVE") return NextResponse.redirect(new URL(`/jobs/${job.slug}`, request.url));

  let destination: URL;
  try {
    destination = new URL(job.applyUrl);
    if (destination.protocol !== "https:" && destination.protocol !== "http:") throw new Error("bad protocol");
  } catch {
    console.error("invalid applyUrl for job", jobId);
    return NextResponse.redirect(new URL(`/jobs/${job.slug}`, request.url));
  }

  const referrer = request.headers.get("referer");
  const countryCode = request.headers.get("x-vercel-ip-country");
  // Read now: the headers are gone by the time after() runs.
  const requestHeaders = new Headers(request.headers);
  // Logging must never delay or break the redirect.
  after(async () => {
    try {
      await db.applyClick.create({
        data: {
          jobId,
          referrer: referrer ? safePath(referrer) : null,
          countryCode: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
        },
      });
    } catch (err) {
      console.error("failed to record apply click", err);
    }

    // Separately, so a failure here can't cost us the anonymous click above.
    try {
      await recordApplication(jobId, requestHeaders);
    } catch (err) {
      console.error("failed to record the application", err);
    }
  });

  return NextResponse.redirect(destination, {
    status: 302,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

/**
 * Notes that this candidate opened the employer's page, for their own list at
 * /account/applications. Nothing is sent to the employer. Runs after the
 * redirect has gone out, so it costs the candidate nothing.
 */
async function recordApplication(jobId: string, requestHeaders: Headers) {
  if (!authEnabled) return;
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return;

  await db.jobApplication.upsert({
    where: { userId_jobId: { userId: session.user.id, jobId } },
    create: { userId: session.user.id, jobId },
    update: { lastClickedAt: new Date() },
  });
}

/** Keep only host + path of the referrer (no query strings, which may carry personal data). */
function safePath(ref: string) {
  try {
    const u = new URL(ref);
    return `${u.host}${u.pathname}`.slice(0, 200);
  } catch {
    return null;
  }
}
