import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Input, Select } from "@/components/ui/field";
import { db } from "@/lib/db";
import { formatPostedAgo, formatSalaryBand } from "@/lib/format";
import type { Prisma } from "@/lib/generated/prisma/client";
import { site } from "@/lib/site";
import { confirmJob, setJobStatus } from "./actions";

export default function AdminJobsPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      {searchParams.then((sp) => (
        <JobsTable
          q={typeof sp.q === "string" ? sp.q.slice(0, 100) : ""}
          status={sp.status === "EXPIRED" ? "EXPIRED" : sp.status === "ALL" ? "ALL" : "ACTIVE"}
          saved={typeof sp.saved === "string" ? sp.saved : undefined}
        />
      ))}
    </Suspense>
  );
}

async function JobsTable({ q, status, saved }: { q: string; status: "ACTIVE" | "EXPIRED" | "ALL"; saved?: string }) {
  await connection();

  const where: Prisma.JobWhereInput = {
    ...(status === "ALL" ? {} : { status }),
    ...(q ? { searchText: { contains: q.toLowerCase() } } : {}),
  };
  const staleBefore = expiresWithinAWeekCutoff();

  const [jobs, total] = await Promise.all([
    db.job.findMany({
      where,
      include: { company: { select: { name: true } }, _count: { select: { applyClicks: true } } },
      orderBy: { postedAt: "desc" },
      take: 100,
    }),
    db.job.count({ where }),
  ]);

  return (
    <>
      {saved && (
        <p role="status" className="mb-4 rounded-lg border border-line-strong bg-card px-4 py-2 text-sm text-fg">
          Saved.{" "}
          <Link href={`/jobs/${saved}`} className="underline underline-offset-4">
            View listing
          </Link>
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold">
          Jobs <span className="text-sm font-normal text-muted tabular-nums">({total})</span>
        </h1>
        <Form action="/admin" className="flex gap-2">
          <Input name="q" defaultValue={q} placeholder="Search title, company…" className="w-56" />
          <Select name="status" defaultValue={status} className="w-32">
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="ALL">All</option>
          </Select>
          <button className="h-10 rounded-lg border border-line-strong px-4 text-sm hover:bg-card">Filter</button>
        </Form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-surface text-left text-[11px] tracking-wide text-subtle uppercase">
            <tr>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Band</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Confirmed</th>
              <th className="px-3 py-2.5 text-right font-medium">Apply clicks</th>
              <th className="px-3 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {jobs.map((job) => (
              <tr key={job.id} className="bg-card align-top">
                <td className="px-3 py-2.5">
                  <Link href={`/admin/jobs/${job.id}`} className="font-medium text-fg hover:underline">
                    {job.title}
                  </Link>
                  <div className="text-xs text-muted">
                    {job.company.name}
                    {job.featured && " · featured"}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted tabular-nums">
                  {formatSalaryBand(job.salaryMin, job.salaryMax, job.currency)}
                </td>
                <td className="px-3 py-2.5">
                  <span className={job.status === "ACTIVE" ? "text-ok" : "text-subtle"}>{job.status.toLowerCase()}</span>
                </td>
                <td className={`px-3 py-2.5 ${job.status === "ACTIVE" && job.lastVerifiedAt < staleBefore ? "text-danger" : "text-muted"}`}>
                  {formatPostedAgo(job.lastVerifiedAt)}
                </td>
                <td className="px-3 py-2.5 text-right text-muted tabular-nums">{job._count.applyClicks}</td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-3 text-xs">
                    <form action={confirmJob}>
                      <input type="hidden" name="id" value={job.id} />
                      <button className="text-muted hover:text-fg">Still open</button>
                    </form>
                    <form action={setJobStatus}>
                      <input type="hidden" name="id" value={job.id} />
                      <input type="hidden" name="status" value={job.status === "ACTIVE" ? "EXPIRED" : "ACTIVE"} />
                      <button className="text-muted hover:text-fg">{job.status === "ACTIVE" ? "Take down" : "Re-open"}</button>
                    </form>
                    <Link href={`/jobs/${job.slug}`} className="text-muted hover:text-fg">
                      View
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  No jobs match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > jobs.length && (
        <p className="mt-3 text-xs text-subtle">Showing the newest {jobs.length}. Narrow the search to find others.</p>
      )}
      <p className="mt-3 text-xs text-subtle">
        Red &ldquo;confirmed&rdquo; dates will expire within a week unless the employer confirms them.
      </p>
    </>
  );
}

/** Active jobs confirmed before this date will be expired by the cron within 7 days. */
function expiresWithinAWeekCutoff() {
  return new Date(Date.now() - (site.expiryDays - 7) * 24 * 60 * 60 * 1000);
}
