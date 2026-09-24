"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { resumeStore } from "@/lib/storage";
import { applicationStageSchema, profileInputSchema } from "@/lib/validators";

export type FormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  saved?: boolean;
};

/**
 * Server actions are POST endpoints, so each one re-reads the session rather
 * than trusting the page that rendered the form.
 */
export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { message: "Please fix the highlighted fields.", errors: z.flattenError(parsed.error).fieldErrors };
  }

  const values = parsed.data;
  await db.candidateProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...values },
    // Cleared fields are written back as null, so removing something removes it.
    update: {
      fullName: values.fullName,
      phone: values.phone ?? null,
      city: values.city ?? null,
      yearsExperience: values.yearsExperience ?? null,
      currentTitle: values.currentTitle ?? null,
      educationLevel: values.educationLevel ?? null,
      degree: values.degree ?? null,
      institution: values.institution ?? null,
      graduationYear: values.graduationYear ?? null,
      linkedinUrl: values.linkedinUrl ?? null,
      githubUrl: values.githubUrl ?? null,
      portfolioUrl: values.portfolioUrl ?? null,
      currentSalary: values.currentSalary ?? null,
      expectedSalary: values.expectedSalary ?? null,
      noticePeriod: values.noticePeriod ?? null,
      skills: values.skills,
    },
  });
  return { saved: true, message: "Profile saved." };
}

/**
 * The candidate's own stage for an application.
 *
 * Lodestar never hears back from an employer — we only know the candidate opened
 * the role — so this is their record to keep, and it is scoped to their own row
 * by userId. Nothing here is ever shown to the employer.
 */
export async function setApplicationStage(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = applicationStageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "That didn't save. Please try again." };
  const { jobId, stage, note } = parsed.data;

  const { count } = await db.jobApplication.updateMany({
    where: { userId: user.id, jobId },
    data: { stage, note: note ?? null, stageUpdatedAt: new Date() },
  });
  if (count === 0) return { message: "We couldn't find that application." };

  return { saved: true, message: "Updated." };
}

export async function deleteResume(): Promise<void> {
  const user = await requireUser();
  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { resumeKey: true },
  });
  if (!profile?.resumeKey) return;

  // The file goes first: a row without a file is recoverable, a file with no
  // row pointing at it is not.
  await resumeStore?.delete(profile.resumeKey);
  await db.candidateProfile.update({
    where: { userId: user.id },
    data: { resumeKey: null, resumeFilename: null, resumeSize: null, resumeType: null, resumeUpdatedAt: null },
  });
}

/**
 * Deletes the account and everything hanging off it. The resume file is
 * removed before the database row, so a storage failure can be retried rather
 * than leaving a file nobody can find.
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (
    String(formData.get("confirm") ?? "")
      .trim()
      .toUpperCase() !== "DELETE"
  ) {
    return { message: "Type DELETE to confirm.", errors: { confirm: ["Type DELETE to confirm."] } };
  }

  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { resumeKey: true },
  });
  if (profile?.resumeKey) {
    try {
      await resumeStore?.delete(profile.resumeKey);
    } catch (err) {
      console.error("could not delete resume during account deletion", profile.resumeKey, err);
      return { message: "We couldn't remove your resume file just now. Please try again in a moment." };
    }
  }

  await auth.api.signOut({ headers: await headers() }).catch(() => {});
  await db.user.delete({ where: { id: user.id } });
  redirect("/?deleted=1");
}
