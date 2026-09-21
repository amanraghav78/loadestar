import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { syncAll } from "@/lib/ingest/sync";
import { revalidateCompanies, revalidateJobs } from "@/lib/revalidate";

// Fetching ~25 job boards takes a while; allow the full Fluid Compute window.
export const maxDuration = 300;

/**
 * Daily (see vercel.json): pulls every company's public job-board feed,
 * adds/updates India roles and takes down roles that disappeared.
 * `?company=<slug>` syncs a single company.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const only = request.nextUrl.searchParams.get("company") ?? undefined;
  const started = Date.now();
  const results = await syncAll(only);
  revalidateJobs();
  revalidateCompanies();

  const totals = results.reduce(
    (t, r) => ({
      listed: t.listed + r.listed,
      withSalary: t.withSalary + r.withSalary,
      created: t.created + r.created,
      updated: t.updated + r.updated,
      expired: t.expired + r.expired,
      failed: t.failed + (r.ok ? 0 : 1),
    }),
    { listed: 0, withSalary: 0, created: 0, updated: 0, expired: 0, failed: 0 },
  );
  console.info("sync cron", { ms: Date.now() - started, ...totals });
  return NextResponse.json({ ms: Date.now() - started, totals, results });
}
