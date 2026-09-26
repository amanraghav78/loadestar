"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { resumeContentSchema } from "@/lib/validators";

/**
 * Saves the resume the candidate is writing.
 *
 * The sections are lists, not a flat form, so the builder sends them as one
 * value. The builder saves on its own a moment after each change, and on the
 * Save button; both come through here. Like every other action it re-reads the
 * session rather than trusting the page that rendered the form, and it writes
 * only its own row.
 */

export type ResumeSaveResult = { ok: true; savedAt: string } | { ok: false; message: string };

export async function saveResumeContent(payload: unknown): Promise<ResumeSaveResult> {
  const user = await requireUser();

  const parsed = resumeContentSchema.safeParse(payload);
  if (!parsed.success) {
    // The form bounds every field itself, so a failure here means the payload
    // didn't come from it. There is no field to point at.
    return { ok: false, message: "Some of that is longer than a resume can hold. Shorten it and save again." };
  }

  const { headline, summary, skills, experience, projects, education, certifications } = parsed.data;
  const values = {
    headline: headline || null,
    summary: summary || null,
    skills,
    experience,
    projects,
    education,
    certifications,
  };

  const row = await db.resumeDocument.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...values },
    update: values,
    select: { updatedAt: true },
  });

  return { ok: true, savedAt: row.updatedAt.toISOString() };
}
