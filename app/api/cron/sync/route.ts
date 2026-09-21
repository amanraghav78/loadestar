import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { syncAll } from "@/lib/ingest/sync";
import { revalidateCompanies, revalidateJobs } from "@/lib/revalidate";

// Use the full Fluid Compute window; the sync itself stops starting new companies after SYNC_BUDGET_MS.
export const maxDuration = 300;
const SYNC_BUDGET_MS = 200_000;

/**
 * Pulls companies' public careers sites, adds/updates India roles posted in
 * the last 30 days, takes down roles that disappeared and deletes anything
 * 30+ days old. Each call handles the least recently synced companies that
 * fit in the time budget; the crons in vercel.json run it several times a
 * day so every company is covered. `?company=<slug>` syncs a single company.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const only = request.nextUrl.searchParams.get("company") ?? undefined;
  const started = Date.now();
  const { results, remaining, purged } = await syncAll({ onlySlug: only, budgetMs: SYNC_BUDGET_MS });
  revalidateJobs();
  revalidateCompanies();

  const totals = results.reduce(
    (t, r) => ({
      companies: t.companies + 1,
      listed: t.listed + r.listed,
      withSalary: t.withSalary + r.withSalary,
      created: t.created + r.created,
      updated: t.updated + r.updated,
      expired: t.expired + r.expired,
      pending: t.pending + r.pending,
      failed: t.failed + (r.ok ? 0 : 1),
    }),
    { companies: 0, listed: 0, withSalary: 0, created: 0, updated: 0, expired: 0, pending: 0, failed: 0 },
  );
  console.info("sync cron", { ms: Date.now() - started, remaining, purged, ...totals });
  return NextResponse.json({ ms: Date.now() - started, remaining, purged, totals, results });
}
