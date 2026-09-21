import Link from "next/link";
import { CompanyAvatar } from "@/components/company-avatar";
import { SaveButton } from "@/components/save-button";
import { Tag } from "@/components/ui/tag";
import { formatJobLocation, formatPostedAgo, formatSalaryBand } from "@/lib/format";
import type { JobCardData } from "@/lib/queries";

export function JobCard({ job }: { job: JobCardData }) {
  return (
    <article className="metal-card group flex min-w-0 flex-1 flex-col rounded-xl p-4">
      <div className="flex items-start gap-3">
        <CompanyAvatar name={job.company.name} logoUrl={job.company.logoUrl} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-fg">
            <Link href={`/jobs/${job.slug}`} className="after:absolute after:inset-0 after:rounded-xl">
              {job.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted">
            {job.company.name} · {formatJobLocation(job)}
          </p>
        </div>
        <SaveButton jobId={job.id} jobTitle={job.title} />
      </div>

      <SalaryLine band={formatSalaryBand(job.salaryMin, job.salaryMax, job.currency)} />

      {job.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills">
          {job.tags.slice(0, 3).map((tag) => (
            <li key={tag}>
              <Tag>{tag}</Tag>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-subtle">
        <time dateTime={job.postedAt.toISOString()}>{formatPostedAgo(job.postedAt)}</time>
      </p>
    </article>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="h-[158px] animate-pulse rounded-xl border border-line bg-card" aria-hidden />
  );
}

export function JobGrid({ jobs }: { jobs: JobCardData[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {jobs.map((job) => (
        <li key={job.id} className="flex min-w-0">
          <JobCard job={job} />
        </li>
      ))}
    </ul>
  );
}

/** Published pay is the headline; missing pay is stated plainly, never hidden. */
export function SalaryLine({ band }: { band: string | null }) {
  if (band) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-fg tabular-nums">
        {band}
        <span className="rounded-full border border-accent/40 bg-accent/10 px-1.5 py-px text-[10px] font-medium tracking-wide text-accent-fg uppercase">
          Pay published
        </span>
      </p>
    );
  }
  return <p className="mt-3 text-sm text-subtle">Salary not disclosed</p>;
}
