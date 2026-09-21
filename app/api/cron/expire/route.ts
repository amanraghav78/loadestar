import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isCronAuthorized } from "@/lib/cron-auth";
import { revalidateJobs } from "@/lib/revalidate";
import { site } from "@/lib/site";

/**
 * Daily (see vercel.json). Takes down every listing the employer hasn't
 * re-confirmed within `site.expiryDays`. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - site.expiryDays * 24 * 60 * 60 * 1000);
  const stale = await db.job.findMany({
    where: { status: "ACTIVE", lastVerifiedAt: { lt: cutoff } },
    select: { id: true, slug: true },
  });

  if (stale.length > 0) {
    await db.job.updateMany({
      where: { id: { in: stale.map((j) => j.id) } },
      data: { status: "EXPIRED" },
    });
    revalidateJobs(stale.map((j) => j.slug));
  }

  console.info(`expire cron: ${stale.length} listings expired`);
  return NextResponse.json({ expired: stale.length });
}
