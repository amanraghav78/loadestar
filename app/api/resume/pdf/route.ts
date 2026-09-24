import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { sanitizeResumeFilename } from "@/lib/resume";
import { readResume } from "@/lib/resume-document";
import { storeResumeFile } from "@/lib/resume-file";
import { buildResumePdf, resumeFileName } from "@/lib/resume-pdf";
import { getUser } from "@/lib/session";
import { resumeStore } from "@/lib/storage";

/**
 * Renders the resume the candidate wrote here and keeps it as their resume on
 * file — the one /api/resume hands back, and the only one anything else reads.
 *
 * Downloading is done in the browser, from the same pure builder
 * (lib/resume-pdf.ts), so the file someone saves is always the draft in front
 * of them. This route is the deliberate other thing: "this version is the one
 * I stand behind", built server-side from what is actually saved.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return new NextResponse("Sign in to continue", { status: 401 });
  if (!resumeStore) return NextResponse.json({ error: "Resume storage isn't available right now." }, { status: 503 });
  if (!(await rateLimit("upload", clientIp(request.headers)))) {
    return NextResponse.json(
      { error: "Too many saves. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const { content, contact, updatedAt } = await readResume(user.id, user.name, user.email);
  if (!updatedAt) return NextResponse.json({ error: "Save your resume first." }, { status: 409 });

  const bytes = buildResumePdf(content, contact);
  // The same sanitiser an uploaded name goes through: this one is built from
  // something the candidate typed, and it ends up in a header.
  const filename = sanitizeResumeFilename(resumeFileName(contact.fullName));

  const savedAt = await storeResumeFile({
    userId: user.id,
    fullName: contact.fullName,
    bytes,
    filename,
    // We wrote it from structured fields, so there is nothing to read back out.
    parsed: false,
  });

  return NextResponse.json({ filename, size: bytes.length, updatedAt: savedAt.toISOString() });
}
