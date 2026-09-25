import { cacheLife, cacheTag } from "next/cache";
import { BriefcaseBusiness } from "lucide-react";
import { SectionHeading } from "@/components/home/section-heading";
import { JobGrid } from "@/components/job-card";
import { EmptyState } from "@/components/ui/empty-state";
import { numberFormat } from "@/lib/format";
import { getHomeData, TAGS } from "@/lib/queries";

/**
 * The home page's shared list of the latest roles, cached like the page around
 * it. It has to be: it renders outside the page's cache scope (as the fallback
 * for <HomeJobs>, and in place of it for signed-out visitors), and the cards
 * read the clock for "3d ago", which a prerender only allows inside a cache.
 *
 * Nothing per-visitor belongs in here; see components/home/home-jobs.tsx.
 */
export async function LatestJobs() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.jobs, TAGS.companies);

  const { recommended: latest, totalActive } = await getHomeData();

  return (
    <>
      <SectionHeading title="Latest jobs" href="/jobs" link={`View all ${numberFormat.format(totalActive)}`} />
      {latest.length > 0 ? (
        <JobGrid jobs={latest} />
      ) : (
        <EmptyState icon={BriefcaseBusiness} title="Fresh jobs are on their way">
          Check back shortly.
        </EmptyState>
      )}
    </>
  );
}
