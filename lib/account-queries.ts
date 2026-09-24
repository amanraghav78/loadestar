import "server-only";
import { db } from "@/lib/db";
import { jobCardSelect } from "@/lib/queries";
import { levelsForExperience, scoreJob, type MatchProfile, type MatchScore } from "@/lib/recommendations";
import { getSessionUser } from "@/lib/session";

/**
 * Per-candidate reads, deliberately kept out of the shared job cache in
 * lib/queries.ts.
 *
 * None of these is cached. Each is a single indexed lookup for one person, so
 * caching would save a millisecond and cost us a class of bugs: a candidate who
 * saves a role, uploads a resume or deletes their account must see that
 * immediately, not after a tag invalidation lands. They run inside a <Suspense>
 * boundary, so the rest of the page still prerenders.
 *
 * Each getter resolves the user from the session itself, so no caller can ask
 * for someone else's rows.
 */

export async function getSavedJobIds(): Promise<string[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const rows = await db.savedJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { jobId: true },
  });
  return rows.map((row) => row.jobId);
}

export async function getProfile() {
  const user = await getSessionUser();
  if (!user) return null;
  return db.candidateProfile.findUnique({
    where: { userId: user.id },
    // resumeKey stays server-side: the browser only ever sees /api/resume.
    select: {
      fullName: true,
      phone: true,
      city: true,
      yearsExperience: true,
      currentTitle: true,
      linkedinUrl: true,
      githubUrl: true,
      portfolioUrl: true,
      currentSalary: true,
      expectedSalary: true,
      noticePeriod: true,
      skills: true,
      resumeFilename: true,
      resumeSize: true,
      resumeUpdatedAt: true,
    },
  });
}

export type CandidateProfileView = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

export async function getApplications() {
  const user = await getSessionUser();
  if (!user) return [];
  return db.jobApplication.findMany({
    where: { userId: user.id },
    orderBy: { lastClickedAt: "desc" },
    take: 100,
    select: {
      lastClickedAt: true,
      job: {
        select: {
          slug: true,
          title: true,
          location: true,
          status: true,
          company: { select: { name: true, slug: true, logoUrl: true } },
        },
      },
    },
  });
}

export type ApplicationView = Awaited<ReturnType<typeof getApplications>>[number];

// -------------------------------------------------------------- recommendations

/** How many roles to rank. Wide enough to rank well, small enough to stay one indexed read. */
const MATCH_POOL = 150;
const MATCH_RESULTS = 12;

export type MatchedJob = Awaited<ReturnType<typeof getRecommendations>>["jobs"][number];

/**
 * Open roles ranked against the candidate's own profile.
 *
 * The shortlist is drawn with one indexed query — `tags` has a GIN index, and
 * the candidate's skills are in the same vocabulary the feeds are tagged with
 * (lib/ingest/classify.ts) — then scored in memory, where the weighting can be
 * explained back to them. Uncached like every other per-candidate read: editing
 * a profile has to change this page immediately or the feature feels broken.
 */
export async function getRecommendations() {
  const user = await getSessionUser();
  if (!user) return { profile: null, jobs: [] };

  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { skills: true, yearsExperience: true, city: true, expectedSalary: true },
  });
  const match: MatchProfile = {
    skills: profile?.skills ?? [],
    yearsExperience: profile?.yearsExperience ?? null,
    city: profile?.city ?? null,
    expectedSalary: profile?.expectedSalary ?? null,
  };
  if (match.skills.length === 0) return { profile: match, jobs: [] };

  const levels = levelsForExperience(match.yearsExperience);
  const applied = await db.jobApplication.findMany({
    where: { userId: user.id },
    select: { jobId: true },
  });

  const rows = await db.job.findMany({
    where: {
      status: "ACTIVE",
      tags: { hasSome: match.skills },
      ...(levels.length > 0 ? { level: { in: levels } } : {}),
      // A role they already opened is not a suggestion any more.
      ...(applied.length > 0 ? { id: { notIn: applied.map((a) => a.jobId) } } : {}),
    },
    select: { ...jobCardSelect, level: true },
    // Rank the freshest roles: an older listing that scores marginally higher
    // is worth less than one posted this week.
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    take: MATCH_POOL,
  });

  const jobs = rows
    .map((job) => ({ job, match: scoreJob(job, match) as MatchScore }))
    .sort((a, b) => b.match.score - a.match.score || b.job.postedAt.getTime() - a.job.postedAt.getTime())
    .slice(0, MATCH_RESULTS);

  return { profile: match, jobs };
}
