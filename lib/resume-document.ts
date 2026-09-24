import "server-only";
import { db } from "@/lib/db";
import { EMPTY_RESUME, type ResumeContact, type ResumeContent } from "@/lib/resume-builder";
import { parseResumeContent } from "@/lib/validators";

/**
 * Reading a candidate's resume back: the document they wrote, plus the contact
 * details it prints, which live on their profile rather than being copied here.
 *
 * `userId` is passed in rather than read from the session, because both callers
 * — the builder page and the PDF download — have already resolved and checked
 * the session themselves. Nothing here is cached: a candidate who edits a line
 * and downloads the file must get the line they just saved.
 */

export type ResumeWorkspace = {
  content: ResumeContent;
  contact: ResumeContact;
  /** Null until they save for the first time; the form starts from their profile. */
  updatedAt: Date | null;
};

export async function readResume(userId: string, fallbackName: string, email: string): Promise<ResumeWorkspace> {
  const [profile, document] = await Promise.all([
    db.candidateProfile.findUnique({
      where: { userId },
      select: {
        fullName: true,
        phone: true,
        city: true,
        currentTitle: true,
        skills: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
      },
    }),
    db.resumeDocument.findUnique({ where: { userId } }),
  ]);

  const contact: ResumeContact = {
    fullName: profile?.fullName?.trim() || fallbackName,
    email,
    phone: profile?.phone ?? null,
    city: profile?.city ?? null,
    linkedinUrl: profile?.linkedinUrl ?? null,
    githubUrl: profile?.githubUrl ?? null,
    portfolioUrl: profile?.portfolioUrl ?? null,
  };

  // A first visit opens on what we already know rather than on an empty page:
  // the title and skills off their profile, which is usually what a resume's
  // header and skills line say anyway. Nothing is stored until they save.
  const content = document
    ? parseResumeContent(document)
    : {
        ...EMPTY_RESUME,
        headline: profile?.currentTitle ?? "",
        skills: profile?.skills ?? [],
      };

  return { content, contact, updatedAt: document?.updatedAt ?? null };
}
