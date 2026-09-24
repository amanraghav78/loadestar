import "server-only";
import { db } from "@/lib/db";
import { getUser, requireUser, UnauthorizedError, type SessionUser } from "@/lib/session";

/**
 * Who a recruiter is allowed to post as.
 *
 * A recruiter may only ever touch the company whose claim an admin approved
 * (lib/validators.ts `companyClaimSchema`, reviewed in /admin/moderation). Every
 * action resolves that here, from the session, rather than trusting a company id
 * in a form — so a recruiter at one company cannot post under another's name.
 */

export type RecruiterCompany = { id: string; name: string; slug: string };

export type RecruiterContext = {
  user: SessionUser;
  isRecruiter: boolean;
  /** The company they may post for, once a claim is approved. */
  company: RecruiterCompany | null;
  /** A claim still waiting on us, or one we turned down, so the page can say so. */
  claim: {
    status: "PENDING" | "REJECTED";
    companyName: string;
    reviewNote: string | null;
  } | null;
};

/** The whole recruiter picture in one read, for rendering a page. */
export async function getRecruiterContext(): Promise<RecruiterContext | null> {
  const user = await getUser();
  if (!user) return null;

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      memberships: {
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          reviewNote: true,
          company: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  const memberships = row?.memberships ?? [];
  const approved = memberships.find((m) => m.status === "APPROVED");
  const outstanding = approved ? undefined : memberships.find((m) => m.status !== "APPROVED");

  return {
    user,
    isRecruiter: row?.role === "RECRUITER",
    company: approved?.company ?? null,
    claim: outstanding
      ? {
          status: outstanding.status as "PENDING" | "REJECTED",
          companyName: outstanding.company.name,
          reviewNote: outstanding.reviewNote,
        }
      : null,
  };
}

/** Thrown by the actions below when someone is signed in but not allowed. */
export class ForbiddenError extends Error {
  constructor(message = "You don't have access to that") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** For actions only a recruiter may call, before any company is approved. */
export async function requireRecruiter(): Promise<SessionUser> {
  const user = await requireUser();
  const row = await db.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (row?.role !== "RECRUITER") throw new ForbiddenError("This is for employer accounts");
  return user;
}

/**
 * For actions that write a listing: resolves the one company this recruiter is
 * approved for, and refuses when there isn't one.
 */
export async function requireRecruiterCompany(): Promise<{ user: SessionUser; company: RecruiterCompany }> {
  const user = await requireRecruiter();
  const membership = await db.companyMember.findFirst({
    where: { userId: user.id, status: "APPROVED" },
    orderBy: { createdAt: "asc" },
    select: { company: { select: { id: true, name: true, slug: true } } },
  });
  if (!membership) throw new ForbiddenError("Your company hasn't been verified yet");
  return { user, company: membership.company };
}

/**
 * One of this recruiter's own listings. Scoped by `postedById` as well as the
 * company, so a second recruiter at the same company can't edit their colleague's
 * posting — and an id from another company matches nothing at all.
 */
export async function requireOwnJob(jobId: string) {
  const { user, company } = await requireRecruiterCompany();
  const job = await db.job.findFirst({
    where: { id: jobId, companyId: company.id, postedById: user.id },
    select: { id: true, slug: true, status: true, title: true },
  });
  if (!job) throw new ForbiddenError("That listing isn't yours");
  return { user, company, job };
}

export { UnauthorizedError };
