import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LinkButton } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatPostedAgo } from "@/lib/format";
import { SyncButton } from "./sync-button";

// "Sync now" runs the full feed sync inside this route's server action.
export const maxDuration = 300;

export default function AdminCompaniesPage() {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Companies</h1>
          <p className="mt-1 text-sm text-muted">
            Companies with a job-board feed are synced daily at 08:00 IST. Others are managed by hand.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <SyncButton />
          <LinkButton href="/admin/companies/new" size="sm" variant="secondary">
            New company
          </LinkButton>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <CompaniesTable />
      </Suspense>
    </>
  );
}

async function CompaniesTable() {
  await connection();
  const companies = await db.company.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      atsSource: true,
      atsToken: true,
      lastSyncedAt: true,
      lastSyncError: true,
      featured: true,
      _count: { select: { jobs: { where: { status: "ACTIVE" } } } },
    },
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="bg-surface text-left text-[11px] tracking-wide text-subtle uppercase">
          <tr>
            <th className="px-3 py-2.5 font-medium">Name</th>
            <th className="px-3 py-2.5 font-medium">Feed</th>
            <th className="px-3 py-2.5 font-medium">Last sync</th>
            <th className="px-3 py-2.5 font-medium">Slug (for CSV import)</th>
            <th className="px-3 py-2.5 text-right font-medium">Live roles</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {companies.map((c) => (
            <tr key={c.id} className="bg-card align-top">
              <td className="px-3 py-2.5">
                <Link href={`/admin/companies/${c.id}`} className="font-medium text-fg hover:underline">
                  {c.name}
                </Link>
                {c.featured && <span className="ml-2 text-xs text-subtle">featured</span>}
              </td>
              <td className="px-3 py-2.5 text-muted">
                {c.atsSource ? `${c.atsSource.toLowerCase()} · ${c.atsToken}` : <span className="text-subtle">manual</span>}
              </td>
              <td className="px-3 py-2.5">
                {c.lastSyncError ? (
                  <span className="text-danger" title={c.lastSyncError}>
                    failed · {c.lastSyncError.slice(0, 60)}
                  </span>
                ) : c.lastSyncedAt ? (
                  <span className="text-muted">{formatPostedAgo(c.lastSyncedAt).toLowerCase()}</span>
                ) : (
                  <span className="text-subtle">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-muted">{c.slug}</td>
              <td className="px-3 py-2.5 text-right text-muted tabular-nums">{c._count.jobs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
