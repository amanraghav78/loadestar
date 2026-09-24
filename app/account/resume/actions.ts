"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { resumeContentSchema } from "@/lib/validators";
import type { FormState } from "../actions";

/**
 * Saves the resume the candidate is writing.
 *
 * The sections are lists, not a flat form, so the builder posts them as one
 * JSON field. Like every other action here it re-reads the session rather than
 * trusting the page that rendered the form, and it writes only its own row.
 */
export async function saveResume(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const raw = formData.get("content");
  let payload: unknown;
  try {
    payload = JSON.parse(typeof raw === "string" ? raw : "");
  } catch {
    return { message: "That didn't save. Reload the page and try again." };
  }

  const parsed = resumeContentSchema.safeParse(payload);
  if (!parsed.success) {
    // The form bounds every field itself, so a failure here means the payload
    // didn't come from it. There is no field to point at.
    return { message: "Some of that is longer than a resume can hold. Shorten it and save again." };
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

  await db.resumeDocument.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...values },
    update: values,
  });

  return { saved: true, message: "Resume saved." };
}
