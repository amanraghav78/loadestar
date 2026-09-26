import "server-only";
import { db } from "@/lib/db";
import type { ResumeContact, ResumeContent } from "@/lib/resume-builder";
import { starterResume } from "@/lib/resume-prefill";
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
  /** The PDF they uploaded to their profile, if any: the builder offers to start from it. */
  uploadedFilename: string | null;
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
        degree: true,
        institution: true,
        graduationYear: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
        resumeKey: true,
        resumeFilename: true,
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
  // the title, skills and highest qualification off their profile, which is
  // what a resume's header, skills line and education say anyway. Nothing is
  // stored until they change something.
  const content = document ? parseResumeContent(document) : starterResume(profile);

  return {
    content,
    contact,
    updatedAt: document?.updatedAt ?? null,
    uploadedFilename: profile?.resumeKey ? (profile.resumeFilename ?? "resume.pdf") : null,
  };
}
