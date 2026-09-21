import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LinkButton } from "@/components/ui/button";
import { db } from "@/lib/db";

export default function AdminCompaniesPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Companies</h1>
        <LinkButton href="/admin/companies/new" size="sm">
          New company
        </LinkButton>
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
      hq: true,
      featured: true,
      _count: { select: { jobs: { where: { status: "ACTIVE" } } } },
    },
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="bg-surface text-left text-[11px] tracking-wide text-subtle uppercase">
          <tr>
            <th className="px-3 py-2.5 font-medium">Name</th>
            <th className="px-3 py-2.5 font-medium">HQ</th>
            <th className="px-3 py-2.5 font-medium">Slug (for CSV import)</th>
            <th className="px-3 py-2.5 text-right font-medium">Active roles</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {companies.map((c) => (
            <tr key={c.id} className="bg-card">
              <td className="px-3 py-2.5">
                <Link href={`/admin/companies/${c.id}`} className="font-medium text-fg hover:underline">
                  {c.name}
                </Link>
                {c.featured && <span className="ml-2 text-xs text-subtle">featured</span>}
              </td>
              <td className="px-3 py-2.5 text-muted">{c.hq}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-muted">{c.slug}</td>
              <td className="px-3 py-2.5 text-right text-muted tabular-nums">{c._count.jobs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
