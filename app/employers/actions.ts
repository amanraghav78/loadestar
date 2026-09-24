"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CAPTCHA_FAILED, verifyCaptcha } from "@/lib/captcha";
import { db } from "@/lib/db";
import { buildSearchText } from "@/lib/format";
import { jobSlug, salaryFields } from "@/lib/admin-jobs";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { ForbiddenError, requireOwnJob, requireRecruiterCompany } from "@/lib/recruiter";
import { revalidateCompanies, revalidateJobs } from "@/lib/revalidate";
import { requireUser } from "@/lib/session";
import { companyClaimSchema, recruiterJobSchema } from "@/lib/validators";

export type FormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  saved?: boolean;
};

const idSchema = z.string().regex(/^[a-z0-9]{10,40}$/i);

/** Turns the thrown authorization errors into something a form can show. */
function refusal(err: unknown): FormState {
  if (err instanceof ForbiddenError) return { message: err.message };
  throw err;
}

/**
 * The role choice. A candidate account and an employer account are different
 * things here, so this is an explicit POST rather than something a link does:
 * nobody is switched to hiring by following a URL.
 */
export async function becomeRecruiter(): Promise<void> {
  const user = await requireUser();
  // Only ever SEEKER → RECRUITER. Going back is a conversation with us, so that
  // a recruiter can't shed their posting history by flipping a switch.
  await db.user.updateMany({ where: { id: user.id, role: "SEEKER" }, data: { role: "RECRUITER" } });
  redirect("/employers");
}

/**
 * Asks for access to a company. An admin approves it in /admin/moderation; until
 * then the recruiter can't post anything.
 */
export async function submitClaim(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const ip = clientIp(await headers());
  if (!(await rateLimit("account", `claim:${user.id}:${ip}`))) {
    return { message: "Too many attempts just now. Try again in a minute." };
  }
  if (!(await verifyCaptcha(formData.get("cf-turnstile-response"), ip))) {
    return { message: CAPTCHA_FAILED };
  }

  const parsed = companyClaimSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { message: "Please fix the highlighted fields.", errors: z.flattenError(parsed.error).fieldErrors };
  }
  const { companyId, workEmail, note } = parsed.data;

  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return { message: "We couldn't find that company.", errors: { companyId: ["Choose a company"] } };

  // An approved claim is never overwritten; a rejected one can be tried again.
  const existing = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: user.id, companyId } },
    select: { status: true },
  });
  if (existing?.status === "APPROVED") return { saved: true, message: "You already have access to this company." };
  if (existing?.status === "PENDING") return { saved: true, message: "That request is already with us." };

  await db.companyMember.upsert({
    where: { userId_companyId: { userId: user.id, companyId } },
    create: { userId: user.id, companyId, workEmail, note: note ?? null },
    // Re-applying clears the previous decision so it comes back to the queue.
    update: { workEmail, note: note ?? null, status: "PENDING", reviewNote: null, reviewedAt: null },
  });

  return { saved: true, message: "Request sent. We usually verify within a working day." };
}

// ---------------------------------------------------------------- listings

/**
 * Posts a role. It goes in as PENDING: an admin approves it before it appears
 * anywhere public, which is what keeps the board free of adverts that aren't jobs.
 */
export async function createRecruiterJob(_prev: FormState, formData: FormData): Promise<FormState> {
  let company, user;
  try {
    ({ user, company } = await requireRecruiterCompany());
  } catch (err) {
    return refusal(err);
  }

  const ip = clientIp(await headers());
  if (!(await rateLimit("account", `post:${user.id}`))) {
    return { message: "That's a lot of postings at once. Try again in a minute." };
  }
  if (!(await verifyCaptcha(formData.get("cf-turnstile-response"), ip))) {
    return { message: CAPTCHA_FAILED };
  }

  // The company is ours to set, not theirs to send.
  const parsed = recruiterJobSchema.safeParse({ ...Object.fromEntries(formData), companyId: company.id });
  if (!parsed.success) {
    return { message: "Please fix the highlighted fields.", errors: z.flattenError(parsed.error).fieldErrors };
  }
  const input = parsed.data;

  await db.job.create({
    data: {
      title: input.title,
      description: input.description,
      companyId: company.id,
      discipline: input.discipline,
      level: input.level,
      employmentType: input.employmentType,
      tags: input.tags,
      location: input.location,
      remote: input.remote,
      remoteRegion: input.remoteRegion ?? null,
      ...salaryFields(input),
      applyUrl: input.applyUrl,
      slug: jobSlug(input.title, company.name),
      searchText: buildSearchText({ ...input, companyName: company.name }),
      status: "PENDING",
      postedById: user.id,
    },
    select: { id: true },
  });

  redirect("/employers?submitted=1");
}

/** Edits one of their own listings. An edit sends it back for approval. */
export async function updateRecruiterJob(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { message: "That listing isn't yours." };

  let owned;
  try {
    owned = await requireOwnJob(id.data);
  } catch (err) {
    return refusal(err);
  }
  const { company } = owned;

  const parsed = recruiterJobSchema.safeParse({ ...Object.fromEntries(formData), companyId: company.id });
  if (!parsed.success) {
    return { message: "Please fix the highlighted fields.", errors: z.flattenError(parsed.error).fieldErrors };
  }
  const input = parsed.data;

  const job = await db.job.update({
    where: { id: owned.job.id },
    data: {
      title: input.title,
      description: input.description,
      discipline: input.discipline,
      level: input.level,
      employmentType: input.employmentType,
      tags: input.tags,
      location: input.location,
      remote: input.remote,
      remoteRegion: input.remoteRegion ?? null,
      ...salaryFields(input),
      applyUrl: input.applyUrl,
      searchText: buildSearchText({ ...input, companyName: company.name }),
      // Anything they change is reviewed again before it goes back up. A closed
      // listing stays closed until they re-open it themselves.
      ...(owned.job.status === "CLOSED" ? {} : { status: "PENDING" as const, moderationNote: null, reviewedAt: null }),
    },
    select: { slug: true },
  });

  revalidateJobs([job.slug]);
  redirect("/employers?updated=1");
}

/**
 * Close, re-open or renew a listing.
 *
 * "Renew" is the weekly confirmation that the role is still open, which is what
 * stops the expiry cron taking it down; it only applies to a live listing.
 */
export async function setRecruiterJobState(formData: FormData): Promise<void> {
  const id = idSchema.parse(formData.get("id"));
  const intent = z.enum(["CLOSE", "REOPEN", "RENEW"]).parse(formData.get("intent"));
  const { job } = await requireOwnJob(id);

  if (intent === "CLOSE") {
    await db.job.update({ where: { id: job.id }, data: { status: "CLOSED" } });
  } else if (intent === "RENEW") {
    if (job.status !== "ACTIVE") throw new ForbiddenError("Only a live listing can be renewed");
    await db.job.update({ where: { id: job.id }, data: { lastVerifiedAt: new Date() } });
  } else {
    // Re-opening is a fresh submission: it was reviewed in whatever state it
    // was closed from, and the role may have changed since.
    if (job.status !== "CLOSED") throw new ForbiddenError("That listing isn't closed");
    await db.job.update({
      where: { id: job.id },
      data: { status: "PENDING", moderationNote: null, reviewedAt: null, lastVerifiedAt: new Date() },
    });
  }

  revalidateJobs([job.slug]);
  revalidateCompanies();
  // The dashboard's own reads are per-recruiter and uncached, so nothing above
  // refreshes them: send them back to it so the row shows its new state.
  redirect("/employers");
}
