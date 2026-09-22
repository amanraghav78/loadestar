import "server-only";
import { db } from "@/lib/db";
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
