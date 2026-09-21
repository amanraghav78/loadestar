import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isCronAuthorized } from "@/lib/cron-auth";
import { purgeOldJobs } from "@/lib/ingest/sync";
import { revalidateJobs } from "@/lib/revalidate";

/** Synced roles no sync has seen for this long are taken down (the company's feed may be broken). */
const UNCONFIRMED_DAYS = 7;

/**
 * Daily (see vercel.json). Deletes every role posted 30 or more days ago and
 * takes down synced roles that haven't been confirmed on the company's careers
 * site for a week. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const deleted = await purgeOldJobs();
  const { count: expired } = await db.job.updateMany({
    where: {
      status: "ACTIVE",
      source: { not: "MANUAL" },
      lastVerifiedAt: { lt: new Date(Date.now() - UNCONFIRMED_DAYS * 24 * 60 * 60 * 1000) },
    },
    data: { status: "EXPIRED" },
  });
  if (deleted > 0 || expired > 0) revalidateJobs();

  console.info(`expire cron: ${deleted} listings over 30 days deleted, ${expired} unconfirmed taken down`);
  return NextResponse.json({ deleted, expired });
}
