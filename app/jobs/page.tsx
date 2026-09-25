import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, SearchX, SlidersHorizontal, X } from "lucide-react";
import { JobCardSkeleton, JobList } from "@/components/job-card";
import { JobFilters } from "@/components/job-filters";
import { SearchBar } from "@/components/search-bar";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DISCIPLINE_LABEL,
  EMPLOYMENT_TYPE_LABEL,
  formatInrShort,
  INDUSTRY_LABEL,
  LEVEL_LABEL,
  numberFormat,
  REMOTE_LABEL,
} from "@/lib/format";
import { searchJobs } from "@/lib/queries";
import { parseSearchParams, toQueryString, type JobSearchParams } from "@/lib/validators";

export const metadata: Metadata = {
  title: "Jobs",
  description: "Search thousands of real tech jobs across India: engineering, data, product and design.",
  alternates: { canonical: "/jobs" },
};

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
  return (
    <Container wide className="py-8 sm:py-10">
      <h1 className="sr-only">Find jobs</h1>
      <Suspense fallback={<ResultsSkeleton />}>
        {searchParams.then((raw) => (
          <Results params={parseSearchParams(raw)} />
        ))}
      </Suspense>
    </Container>
  );
}

/** Every filter currently applied, each with a link that removes it. */
function activeFilters(params: JobSearchParams) {
  const without = (key: keyof JobSearchParams) =>
    `/jobs${toQueryString({ ...params, [key]: undefined, cursor: undefined })}`;
  const out: { label: string; href: string }[] = [];
  if (params.q) out.push({ label: `“${params.q}”`, href: without("q") });
  if (params.location) out.push({ label: params.location, href: without("location") });
  if (params.city) out.push({ label: params.city, href: without("city") });
  if (params.discipline) out.push({ label: DISCIPLINE_LABEL[params.discipline], href: without("discipline") });
  if (params.level) out.push({ label: LEVEL_LABEL[params.level], href: without("level") });
  if (params.remote) out.push({ label: REMOTE_LABEL[params.remote], href: without("remote") });
  if (params.employmentType)
    out.push({ label: EMPLOYMENT_TYPE_LABEL[params.employmentType], href: without("employmentType") });
  if (params.industry) out.push({ label: INDUSTRY_LABEL[params.industry], href: without("industry") });
  if (params.salary) out.push({ label: "With salary", href: without("salary") });
  if (params.minSalary) out.push({ label: `₹${formatInrShort(params.minSalary)}+`, href: without("minSalary") });
  if (params.tag) out.push({ label: params.tag, href: without("tag") });
  return out;
}

async function Results({ params }: { params: JobSearchParams }) {
  const { jobs, total, nextCursor } = await searchJobs(params);
  const active = activeFilters(params);
  const filterCount = active.filter((f) => !f.label.startsWith("“")).length;

  return (
    <>
      <SearchBar q={params.q} location={params.location} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[15.5rem_1fr]">
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start" aria-label="Filters">
          <JobFilters params={params} />
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <details className="metal group mb-5 rounded-2xl lg:hidden">
            <summary className="text-fg flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="text-muted size-4" aria-hidden />
              Filters
              {filterCount > 0 && (
                <span className="bg-tint-strong rounded-full px-1.5 text-[11px] tabular-nums">{filterCount}</span>
              )}
              <span className="text-muted ml-auto text-xs group-open:hidden">Show</span>
              <span className="text-muted ml-auto hidden text-xs group-open:inline">Hide</span>
            </summary>
            <div className="border-line border-t p-4">
              <JobFilters params={params} />
            </div>
          </details>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <h2 id="results-heading" className="text-fg mr-2 text-lg font-semibold" aria-live="polite">
              <span className="tabular-nums">{numberFormat.format(total)}</span> {total === 1 ? "job" : "jobs"}
            </h2>
            {active.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className="chip h-7 gap-1 px-2.5 text-xs"
                aria-label={`Remove filter ${f.label}`}
              >
                {f.label}
                <X className="size-3" aria-hidden />
              </Link>
            ))}
            {active.length > 1 && (
              <Link href="/jobs" className="text-muted hover:text-fg text-xs underline-offset-4 hover:underline">
                Clear all
              </Link>
            )}
          </div>

          {jobs.length > 0 ? (
            <JobList jobs={jobs} />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No jobs match that search"
              action={
                <Link href="/jobs" className={buttonClass("secondary", "md")}>
                  Show all jobs
                </Link>
              }
            >
              Try fewer filters or a broader keyword.
            </EmptyState>
          )}

          <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-4">
            {params.cursor ? (
              <Link
                href={`/jobs${toQueryString({ ...params, cursor: undefined })}`}
                className="text-muted hover:text-fg text-sm"
              >
                Back to newest
              </Link>
            ) : (
              <span />
            )}
            {nextCursor && (
              <Link
                href={`/jobs${toQueryString({ ...params, cursor: nextCursor })}`}
                className={buttonClass("secondary", "md")}
              >
                More jobs <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </nav>
        </section>
      </div>
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading jobs">
      <div className="border-line bg-card h-[54px] animate-pulse rounded-full border" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[15.5rem_1fr]">
        <div className="bg-card hidden h-96 animate-pulse rounded-2xl lg:block" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
