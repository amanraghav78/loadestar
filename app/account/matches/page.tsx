import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getRecommendations } from "@/lib/account-queries";
import { authEnabled } from "@/lib/auth";
import { LEVEL_LABEL } from "@/lib/format";
import { levelsForExperience } from "@/lib/recommendations";
import { requireUserPage } from "@/lib/session";
import { Sparkles } from "lucide-react";
import { JobCard, JobCardSkeleton } from "@/components/job-card";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountTabs } from "../account-tabs";

export const metadata: Metadata = {
  title: "Roles that match you",
  robots: { index: false, follow: false },
};

export default function MatchesPage() {
  if (!authEnabled) notFound();

  return (
    <Container className="py-10">
      <AccountTabs current="/account/matches" />
      <h1 className="steel-text text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Matches</h1>
      <p className="text-muted mt-2 max-w-xl text-sm">
        Open roles ranked against the skills and experience on your profile.{" "}
        <Link href="/account" className="underline underline-offset-2">
          Edit your profile
        </Link>
      </p>

      <Suspense
        fallback={
          <ul className="mt-10 grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <JobCardSkeleton />
              </li>
            ))}
          </ul>
        }
      >
        <Matches />
      </Suspense>
    </Container>
  );
}

async function Matches() {
  await requireUserPage("/account/matches");
  const { profile, jobs } = await getRecommendations();

  if (!profile || profile.skills.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Add your skills to see matches"
        action={
          <Link href="/account" className={buttonClass("primary", "md")}>
            Go to your profile
          </Link>
        }
        className="mt-10"
      >
        We match on skills. Upload your resume and we&rsquo;ll read them out of it, or type them in yourself.
      </EmptyState>
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No matches today"
        action={
          <Link href="/jobs" className={buttonClass("secondary", "md")}>
            Browse all jobs
          </Link>
        }
        className="mt-10"
      >
        Nothing open matches your skills right now. Listings change daily, so it is worth checking back.
      </EmptyState>
    );
  }

  const levels = levelsForExperience(profile.yearsExperience);

  return (
    <>
      <p className="text-subtle mt-8 text-xs">
        Matching on {profile.skills.slice(0, 6).join(", ")}
        {profile.skills.length > 6 && ` and ${profile.skills.length - 6} more`}
        {levels.length > 0 && ` · ${levels.map((level) => LEVEL_LABEL[level]).join(", ")} roles`}
        {profile.city && ` · around ${profile.city}`}
      </p>

      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {jobs.map(({ job, match }) => (
          <li key={job.id} className="flex min-w-0 flex-col gap-1.5">
            <JobCard job={job} />
            {match.reasons.length > 0 && <p className="text-subtle px-1 text-xs">{match.reasons.join(" · ")}</p>}
          </li>
        ))}
      </ul>

      <p className="text-subtle mt-8 max-w-xl text-xs">
        Ranked by how many of your skills a role asks for, whether it is at your level, where it is, and whether the
        published pay meets what you expect. Roles you have already opened are left out.
      </p>
    </>
  );
}
