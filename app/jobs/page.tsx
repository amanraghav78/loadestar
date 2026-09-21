import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { JobCardSkeleton, JobGrid } from "@/components/job-card";
import { JobFilters } from "@/components/job-filters";
import { SearchBar } from "@/components/search-bar";
import { Container } from "@/components/ui/container";
import { DISCIPLINE_LABEL, numberFormat } from "@/lib/format";
import { searchJobs } from "@/lib/queries";
import { parseSearchParams, toQueryString, type JobSearchParams } from "@/lib/validators";

export const metadata: Metadata = {
  title: "Find jobs",
  description: "Engineering, design, product and data roles at companies hiring in India, straight from their careers pages.",
  alternates: { canonical: "/jobs" },
};

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
  return (
    <Container wide className="py-10">
      <h1 className="metal-text text-2xl font-semibold tracking-tight">Find jobs</h1>
      <Suspense fallback={<ResultsSkeleton />}>
        {searchParams.then((raw) => (
          <Results params={parseSearchParams(raw)} />
        ))}
      </Suspense>
    </Container>
  );
}

function describe(params: JobSearchParams) {
  const parts: string[] = [];
  if (params.q) parts.push(`“${params.q}”`);
  if (params.discipline) parts.push(DISCIPLINE_LABEL[params.discipline]);
  if (params.tag) parts.push(params.tag);
  if (params.location) parts.push(`in ${params.location}`);
  if (params.city) parts.push(`in ${params.city}`);
  if (params.salary) parts.push("with salary");
  return parts.join(" · ");
}

async function Results({ params }: { params: JobSearchParams }) {
  const { jobs, total, nextCursor } = await searchJobs(params);
  const summary = describe(params);

  return (
    <>
      <div className="mt-6">
        <SearchBar q={params.q} location={params.location} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <JobFilters params={params} />
        </aside>

        <section aria-labelledby="results-heading">
          <h2 id="results-heading" className="mb-4 text-sm text-muted" aria-live="polite">
            <span className="font-medium text-fg tabular-nums">{numberFormat.format(total)}</span>{" "}
            {total === 1 ? "role" : "roles"}
            {summary && <> · {summary}</>}
          </h2>

          {jobs.length > 0 ? (
            <JobGrid jobs={jobs} />
          ) : (
            <div className="rounded-xl border border-dashed border-line p-10 text-center">
              <p className="text-sm text-fg">No roles match those filters.</p>
              <p className="mt-1 text-sm text-muted">Try a broader search or remove a filter.</p>
              <Link href="/jobs" className="mt-4 inline-block text-sm text-fg underline underline-offset-4">
                Clear all filters
              </Link>
            </div>
          )}

          <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
            {params.cursor ? (
              <Link href={`/jobs${toQueryString({ ...params, cursor: undefined })}`} className="text-sm text-muted hover:text-fg">
                Back to newest
              </Link>
            ) : (
              <span />
            )}
            {nextCursor && (
              <Link
                href={`/jobs${toQueryString({ ...params, cursor: nextCursor })}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-4 py-2 text-sm text-fg hover:bg-card"
              >
                More roles <ArrowRight className="size-3.5" aria-hidden />
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
    <div className="mt-6" aria-busy="true" aria-label="Loading roles">
      <div className="h-[58px] animate-pulse rounded-xl border border-line bg-card" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr]">
        <div className="hidden h-80 animate-pulse rounded-xl bg-card lg:block" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
