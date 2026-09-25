import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { LatestJobs } from "@/components/home/latest-jobs";
import { SectionHeading } from "@/components/home/section-heading";
import { JobGrid } from "@/components/job-card";
import { getRecommendations } from "@/lib/account-queries";
import { authEnabled } from "@/lib/auth";
import { homeJobsView } from "@/lib/recommendations";
import { getSessionUser } from "@/lib/session";

/**
 * The home page's first list of roles: the latest for everyone, or roles picked
 * for a signed-in candidate we have something to match on.
 *
 * The page itself is cached and shared, so this can't be decided there. The page
 * renders <HomeJobs> behind a <Suspense> boundary whose fallback is
 * <LatestJobs>: the static shell carries the latest roles, and a candidate's own
 * picks stream in over them at request time. Six cards either way, in the same
 * grid, so the swap doesn't move the page.
 *
 * Deliberately uncached: see the note on getRecommendations.
 */

/** As many as the latest list shows (getHomeData), so the two are the same height. */
const HOME_JOBS = 6;

/**
 * Reads the session, so it must sit behind <Suspense>. The recommendations are
 * the same uncached per-candidate read /account/matches makes (its top six), so
 * nothing personal ever lands in a cache another visitor could be served from.
 */
export async function HomeJobs() {
  if (!authEnabled) return <LatestJobs />;
  const user = await getSessionUser();
  if (!user) return <LatestJobs />;

  let recommendations: Awaited<ReturnType<typeof getRecommendations>>;
  try {
    recommendations = await getRecommendations({ limit: HOME_JOBS });
  } catch (err) {
    // Personalising is a nicety; a failure here must not take the home page down.
    unstable_rethrow(err);
    console.error("home recommendations failed", err);
    return <LatestJobs />;
  }

  const { profile, jobs } = recommendations;
  const view = homeJobsView({ signedIn: true, profile, matches: jobs.length });
  if (view === "latest") return <LatestJobs />;
  if (view === "latest-nudge") {
    return (
      <>
        <LatestJobs />
        <p className="text-subtle mt-4 text-sm">
          <Link href="/account" className="hover:text-fg underline underline-offset-2 transition-colors">
            Add your skills or upload your resume
          </Link>{" "}
          and we&rsquo;ll pick roles for you here.
        </p>
      </>
    );
  }

  return (
    <>
      <SectionHeading title="Recommended for you" href="/account/matches" link="See all matches" />
      <JobGrid jobs={jobs.map(({ job }) => job)} />
    </>
  );
}
