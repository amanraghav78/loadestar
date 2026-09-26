import "server-only";
import { db } from "@/lib/db";

/**
 * Reads for the employer dashboard. Uncached for the same reason as the
 * candidate reads in lib/account-queries.ts: a recruiter who posts, edits or
 * closes a role has to see it immediately, and none of this is shared between
 * people so there is nothing to gain by caching it.
 */

/** Companies a recruiter can claim: everything we list, for the claim dropdown. */
export async function getClaimableCompanies() {
  return db.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 1000,
  });
}

/**
 * This recruiter's own listings, newest first, with the two counts they can
 * act on: how many people opened the apply link, and how many signed-in
 * candidates recorded it as an application.
 */
export async function getRecruiterJobs(userId: string) {
  return db.job.findMany({
    where: { postedById: userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      location: true,
      remote: true,
      remoteRegion: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      employmentType: true,
      moderationNote: true,
      postedAt: true,
      lastVerifiedAt: true,
      createdAt: true,
      _count: { select: { applyClicks: true, applications: true } },
    },
  });
}

export type RecruiterJob = Awaited<ReturnType<typeof getRecruiterJobs>>[number];

/** One of their listings, in the shape the edit form takes. */
export async function getRecruiterJob(jobId: string, userId: string) {
  return db.job.findFirst({
    where: { id: jobId, postedById: userId },
    select: {
      id: true,
      title: true,
      description: true,
      companyId: true,
      discipline: true,
      level: true,
      employmentType: true,
      tags: true,
      location: true,
      remote: true,
      remoteRegion: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      experienceMin: true,
      experienceMax: true,
      applyUrl: true,
      status: true,
      moderationNote: true,
    },
  });
}
