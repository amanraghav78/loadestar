import "server-only";
import { db } from "@/lib/db";
import { RESUME_TYPE, resumeObjectKey } from "@/lib/resume";
import { resumeStore } from "@/lib/storage";

/**
 * Putting a resume PDF in the candidate's own slot: one file per person, in the
 * private bucket, with the row pointing at it.
 *
 * Shared by the two ways a file gets there — a PDF they uploaded, and one
 * Lodestar rendered from the resume they wrote here — so that replacing one
 * always removes the file it replaced. That is the part worth having in one
 * place: a bucket that quietly keeps old resumes makes "delete my account"
 * untrue.
 */
export async function storeResumeFile(params: {
  userId: string;
  /** Used only to create the profile row if there isn't one yet. */
  fullName: string;
  bytes: Uint8Array;
  /** Already sanitised — see `sanitizeResumeFilename`. */
  filename: string;
  /** Whether we read anything out of it, for `resumeParsedAt`. */
  parsed: boolean;
}): Promise<Date> {
  if (!resumeStore) throw new Error("no resume store configured");
  const { userId, fullName, bytes, filename, parsed } = params;

  const key = resumeObjectKey(userId);
  const previous = await db.candidateProfile.findUnique({ where: { userId }, select: { resumeKey: true } });

  await resumeStore.put(key, bytes, RESUME_TYPE);

  const now = new Date();
  const fields = {
    resumeKey: key,
    resumeFilename: filename,
    resumeSize: bytes.length,
    resumeType: RESUME_TYPE,
    resumeUpdatedAt: now,
    resumeParsedAt: parsed ? now : null,
  };
  await db.candidateProfile.upsert({
    where: { userId },
    create: { userId, fullName, ...fields },
    update: fields,
  });

  // Replacing a resume removes the old file, or "we deleted it" stops being true.
  if (previous?.resumeKey && previous.resumeKey !== key) {
    try {
      await resumeStore.delete(previous.resumeKey);
    } catch (err) {
      console.error("could not remove the replaced resume", previous.resumeKey, err);
    }
  }

  return now;
}
