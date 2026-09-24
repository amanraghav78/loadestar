import Link from "next/link";
import { MapPin } from "lucide-react";
import { CompanyAvatar } from "@/components/company-avatar";
import { SaveButton } from "@/components/save-button";
import { formatAge, formatPostedAgo, formatSalaryBand, REMOTE_LABEL } from "@/lib/format";
import type { JobCardData } from "@/lib/queries";
import { cn } from "@/lib/cn";

export function JobCard({ job }: { job: JobCardData }) {
  const band = formatSalaryBand(job.salaryMin, job.salaryMax, job.currency);
  const place = job.remote === "REMOTE" && job.location === "India" ? "Anywhere in India" : job.location;

  return (
    <article className="metal-card group flex min-w-0 flex-1 flex-col rounded-2xl p-5">
      <div className="flex items-start gap-3.5">
        <CompanyAvatar company={job.company} />
        <div className="min-w-0 flex-1">
          <p className="text-muted truncate text-xs font-medium">{job.company.name}</p>
          <h3 className="text-fg mt-1 line-clamp-2 text-[15px] leading-snug font-semibold">
            <Link href={`/jobs/${job.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
              {job.title}
            </Link>
          </h3>
        </div>
        <SaveButton jobId={job.id} jobTitle={job.title} />
      </div>

      <div className="text-muted mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs">
        {band && <SalaryPill band={band} />}
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="text-subtle size-3 shrink-0" aria-hidden />
          <span className="truncate">{place}</span>
        </span>
        {job.remote !== "ONSITE" && (
          <span className="border-line rounded-full border px-2 py-0.5 text-[11px]">{REMOTE_LABEL[job.remote]}</span>
        )}
        <time
          dateTime={job.postedAt.toISOString()}
          title={formatPostedAgo(job.postedAt)}
          className="text-subtle ml-auto shrink-0 tabular-nums"
        >
          {formatAge(job.postedAt)}
        </time>
      </div>
    </article>
  );
}

/** Published pay, in polished silver. Missing pay is simply not shown on cards. */
export function SalaryPill({ band, large = false }: { band: string; large?: boolean }) {
  return (
    <span
      className={cn(
        "text-fg inline-flex items-center gap-1.5 rounded-full border-line-hover bg-tint-strong border font-semibold tabular-nums shadow-[inset_0_1px_0_var(--edge-strong)]",
        large ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
      )}
    >
      <span className="bg-accent-fg size-1.5 rounded-full" aria-hidden />
      {band}
    </span>
  );
}

export function JobCardSkeleton() {
  return <div className="border-line bg-card h-[150px] animate-pulse rounded-2xl border" aria-hidden />;
}

/** Cards in columns (home, similar roles). */
export function JobGrid({ jobs }: { jobs: JobCardData[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <li key={job.id} className="flex min-w-0">
          <JobCard job={job} />
        </li>
      ))}
    </ul>
  );
}

/** Cards in one or two columns next to a sidebar (search results, company pages, saved). */
export function JobList({ jobs }: { jobs: JobCardData[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {jobs.map((job) => (
        <li key={job.id} className="flex min-w-0">
          <JobCard job={job} />
        </li>
      ))}
    </ul>
  );
}
