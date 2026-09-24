import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { numberFormat } from "@/lib/format";

/**
 * Operator numbers: how much is live, who is using it, and what is waiting on
 * us. Everything is counted at read time — these are admin-only reads behind
 * HTTP Basic auth, so nothing here is cached or shared.
 */
export default function AnalyticsPage() {
  return (
    <Suspense fallback={<p className="text-muted text-sm">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}

const DAY = 24 * 60 * 60 * 1000;

/** Kept out of the component body: the clock is not something render may read. */
function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY);
}

async function Dashboard() {
  await connection();
  const last7 = daysAgo(7);
  const last30 = daysAgo(30);

  const [
    activeJobs,
    withBand,
    pendingJobs,
    closedJobs,
    companies,
    hiringCompanies,
    users,
    recruiters,
    newUsers7,
    profiles,
    resumes,
    savedJobs,
    applications,
    applications7,
    applyClicks,
    applyClicks7,
    reviews,
    pendingReviews,
    pendingClaims,
    topJobs,
    stages,
  ] = await Promise.all([
    db.job.count({ where: { status: "ACTIVE" } }),
    db.job.count({ where: { status: "ACTIVE", salaryDisclosed: true } }),
    db.job.count({ where: { status: "PENDING" } }),
    db.job.count({ where: { status: { in: ["CLOSED", "EXPIRED"] } } }),
    db.company.count(),
    db.company.count({ where: { jobs: { some: { status: "ACTIVE" } } } }),
    db.user.count(),
    db.user.count({ where: { role: "RECRUITER" } }),
    db.user.count({ where: { createdAt: { gte: last7 } } }),
    db.candidateProfile.count(),
    db.candidateProfile.count({ where: { resumeKey: { not: null } } }),
    db.savedJob.count(),
    db.jobApplication.count(),
    db.jobApplication.count({ where: { createdAt: { gte: last7 } } }),
    db.applyClick.count(),
    db.applyClick.count({ where: { createdAt: { gte: last7 } } }),
    db.companyReview.count({ where: { status: "APPROVED" } }),
    db.companyReview.count({ where: { status: "PENDING" } }),
    db.companyMember.count({ where: { status: "PENDING" } }),
    // What candidates actually clicked through to, this month.
    db.job.findMany({
      where: { applyClicks: { some: { createdAt: { gte: last30 } } } },
      orderBy: { applyClicks: { _count: "desc" } },
      take: 10,
      select: {
        slug: true,
        title: true,
        status: true,
        company: { select: { name: true } },
        _count: { select: { applyClicks: { where: { createdAt: { gte: last30 } } } } },
      },
    }),
    db.jobApplication.groupBy({ by: ["stage"], _count: { _all: true } }),
  ]);

  const waiting = pendingJobs + pendingReviews + pendingClaims;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">Analytics</h1>
        {waiting > 0 && (
          <Link href="/admin/moderation" className="text-accent-fg text-sm hover:underline">
            {waiting} waiting on moderation →
          </Link>
        )}
      </div>

      <Group title="Listings">
        <Stat label="Live" value={activeJobs} />
        <Stat label="With a band" value={withBand} of={activeJobs} />
        <Stat label="In review" value={pendingJobs} />
        <Stat label="Closed or expired" value={closedJobs} />
      </Group>

      <Group title="Companies">
        <Stat label="Total" value={companies} />
        <Stat label="Hiring now" value={hiringCompanies} of={companies} />
        <Stat label="Published reviews" value={reviews} />
        <Stat label="Claims waiting" value={pendingClaims} />
      </Group>

      <Group title="People">
        <Stat label="Accounts" value={users} />
        <Stat label="Employers" value={recruiters} of={users} />
        <Stat label="New this week" value={newUsers7} />
        <Stat label="With a profile" value={profiles} of={users} />
        <Stat label="With a resume" value={resumes} of={profiles} />
      </Group>

      <Group title="Activity">
        <Stat label="Apply clicks" value={applyClicks} />
        <Stat label="Apply clicks, 7d" value={applyClicks7} />
        <Stat label="Applications recorded" value={applications} />
        <Stat label="Applications, 7d" value={applications7} />
        <Stat label="Saved roles" value={savedJobs} />
      </Group>

      <section className="mb-10">
        <h2 className="text-subtle mb-3 text-[11px] font-medium tracking-[0.12em] uppercase">
          Where candidates say they got to
        </h2>
        {applications === 0 ? (
          <p className="border-line text-muted rounded-xl border border-dashed p-6 text-center text-sm">
            No applications recorded yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {stages.map((row) => (
              <li key={row.stage} className="text-muted">
                <span className="text-fg font-medium tabular-nums">{numberFormat.format(row._count._all)}</span>{" "}
                {row.stage.toLowerCase()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-subtle mb-3 text-[11px] font-medium tracking-[0.12em] uppercase">
          Most clicked roles, last 30 days
        </h2>
        {topJobs.length === 0 ? (
          <p className="border-line text-muted rounded-xl border border-dashed p-6 text-center text-sm">
            No apply clicks in the last 30 days.
          </p>
        ) : (
          <div className="border-line overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-surface text-subtle text-left text-[11px] tracking-wide uppercase">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {topJobs.map((job) => (
                  <tr key={job.slug} className="bg-card">
                    <td className="px-3 py-2.5">
                      <Link href={`/jobs/${job.slug}`} className="text-fg font-medium hover:underline">
                        {job.title}
                      </Link>
                      <div className="text-muted text-xs">{job.company.name}</div>
                    </td>
                    <td className="text-muted px-3 py-2.5 text-xs">{job.status.toLowerCase()}</td>
                    <td className="text-muted px-3 py-2.5 text-right tabular-nums">
                      {numberFormat.format(job._count.applyClicks)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-subtle mb-3 text-[11px] font-medium tracking-[0.12em] uppercase">{title}</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</dl>
    </section>
  );
}

/** `of` adds the share of a total, which is usually the interesting part. */
function Stat({ label, value, of }: { label: string; value: number; of?: number }) {
  const share = of && of > 0 ? Math.round((value / of) * 100) : null;
  return (
    <div className="border-line bg-card rounded-xl border p-4">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="text-fg mt-1 text-2xl font-semibold tabular-nums">
        {numberFormat.format(value)}
        {share != null && <span className="text-subtle ml-1.5 text-xs font-normal">{share}%</span>}
      </dd>
    </div>
  );
}
