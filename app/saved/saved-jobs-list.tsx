"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { JobCardSkeleton, JobList } from "@/components/job-card";
import { buttonClass } from "@/components/ui/button";
import type { JobCardData } from "@/lib/queries";
import { useSavedJobs } from "@/lib/saved-jobs";

type ApiJob = Omit<JobCardData, "postedAt"> & { postedAt: string; status: "ACTIVE" | "EXPIRED" };
type State = { key: string; jobs: (JobCardData & { status: ApiJob["status"] })[] } | { key: string; error: true };

export function SavedJobsList() {
  const { ids, remove } = useSavedJobs();
  const key = ids.join(",");
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch(`/api/jobs?ids=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ jobs: ApiJob[] }>;
      })
      .then(({ jobs }) =>
        setState({ key, jobs: jobs.map((j) => ({ ...j, postedAt: new Date(j.postedAt) })) }),
      )
      .catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") setState({ key, error: true });
      });
    return () => controller.abort();
  }, [key]);

  if (ids.length === 0) {
    return (
      <div className="metal rounded-3xl p-12 text-center">
        <p className="text-base font-medium text-fg">No saved roles yet.</p>
        <p className="mt-1 text-sm text-muted">Tap the bookmark on any job to keep it here.</p>
        <Link href="/jobs" className={buttonClass("primary", "md", "mt-5")}>
          Browse jobs
        </Link>
      </div>
    );
  }

  if (!state || state.key !== key) {
    return (
      <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
        {ids.slice(0, 4).map((id) => (
          <JobCardSkeleton key={id} />
        ))}
      </div>
    );
  }

  if ("error" in state) {
    return <p className="text-sm text-danger">Couldn&rsquo;t load your saved roles. Please refresh to try again.</p>;
  }

  // Keep the order the user saved them in.
  const byId = new Map(state.jobs.map((j) => [j.id, j]));
  const ordered = ids.map((id) => byId.get(id)).filter((j) => j !== undefined);
  const active = ordered.filter((j) => j.status === "ACTIVE");
  const expired = ordered.filter((j) => j.status === "EXPIRED");
  const missing = ids.filter((id) => !byId.has(id));

  return (
    <div className="space-y-10">
      {active.length > 0 ? (
        <JobList jobs={active} />
      ) : (
        <p className="text-sm text-muted">None of your saved jobs are open any more.</p>
      )}
      {(expired.length > 0 || missing.length > 0) && (
        <section className="metal rounded-2xl p-5">
          <h2 className="text-sm font-medium text-fg">
            {expired.length + missing.length} saved {expired.length + missing.length === 1 ? "role has" : "roles have"}{" "}
            closed
          </h2>
          {expired.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {expired.map((j) => (
                <li key={j.id}>
                  {j.title} · {j.company.name}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => remove([...expired.map((j) => j.id), ...missing])}
            className="mt-3 text-xs text-muted underline underline-offset-4 hover:text-fg"
          >
            Clear closed roles
          </button>
        </section>
      )}
    </div>
  );
}
