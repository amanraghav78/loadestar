import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { countSuggestions, parseResumeText, type ResumeSuggestions } from "@/lib/resume-parse";
import { extractResumeText } from "@/lib/resume-text";
import { checkResumeBytes, resumeObjectKey, RESUME_ERROR, RESUME_TYPE, sanitizeResumeFilename } from "@/lib/resume";
import { getUser } from "@/lib/session";
import { resumeStore } from "@/lib/storage";

/**
 * The candidate's own resume. Every method works on the caller's file and
 * takes no id, so there is nothing to tamper with: one signed-in person can
 * only ever reach their own document.
 */

const unauthorized = () => new NextResponse("Sign in to continue", { status: 401 });
const tooMany = () =>
  new NextResponse("Too many uploads. Try again in a minute.", { status: 429, headers: { "Retry-After": "60" } });

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return unauthorized();
  if (!resumeStore) return NextResponse.json({ error: "Resume upload isn't available right now." }, { status: 503 });
  // Checked before the body is read, so a flood can't make us buffer megabytes.
  if (!(await rateLimit("upload", clientIp(request.headers)))) return tooMany();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF to upload." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  // The bytes we actually received decide this, never the size or type the browser claimed.
  const rejection = checkResumeBytes(bytes);
  if (rejection) return NextResponse.json({ error: RESUME_ERROR[rejection] }, { status: 400 });

  const filename = sanitizeResumeFilename(file.name);
  const key = resumeObjectKey(user.id);
  const previous = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { resumeKey: true },
  });

  await resumeStore.put(key, bytes, RESUME_TYPE);

  // Reading the file is a convenience, never a condition of storing it: a PDF
  // we can't parse (a scan, an unusual producer, a password) still uploads.
  const suggestions = await readSuggestions(bytes);

  const now = new Date();
  const resumeFields = {
    resumeKey: key,
    resumeFilename: filename,
    resumeSize: bytes.length,
    resumeType: RESUME_TYPE,
    resumeUpdatedAt: now,
    resumeParsedAt: suggestions ? now : null,
  };
  await db.candidateProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, fullName: user.name, ...resumeFields },
    update: resumeFields,
  });

  // Replacing a resume removes the old file, or "we deleted it" stops being true.
  if (previous?.resumeKey && previous.resumeKey !== key) {
    try {
      await resumeStore.delete(previous.resumeKey);
    } catch (err) {
      console.error("could not remove the replaced resume", previous.resumeKey, err);
    }
  }

  return NextResponse.json({
    filename,
    size: bytes.length,
    updatedAt: now.toISOString(),
    // The candidate reviews these in the form and saves them themselves;
    // nothing read out of a resume is written to the profile behind their back.
    suggestions,
    suggestionCount: suggestions ? countSuggestions(suggestions) : 0,
  });
}

/** Never throws: a parse failure costs the candidate a convenience, not their upload. */
async function readSuggestions(bytes: Uint8Array): Promise<ResumeSuggestions | null> {
  try {
    const text = await extractResumeText(bytes);
    if (!text) return null;
    const suggestions = parseResumeText(text);
    return countSuggestions(suggestions) > 0 ? suggestions : null;
  } catch (err) {
    console.error("could not read the uploaded resume", err);
    return null;
  }
}

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { resumeKey: true, resumeFilename: true, resumeType: true },
  });
  if (!profile?.resumeKey || !resumeStore) return new NextResponse("No resume on file", { status: 404 });

  const object = await resumeStore.get(profile.resumeKey);
  if (!object) return new NextResponse("No resume on file", { status: 404 });

  return new NextResponse(object.body, {
    headers: {
      "Content-Type": profile.resumeType ?? RESUME_TYPE,
      // Always a download, and never sniffed into something executable.
      "Content-Disposition": `attachment; filename="${profile.resumeFilename ?? "resume.pdf"}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      ...(object.size ? { "Content-Length": String(object.size) } : {}),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return unauthorized();
  if (!(await rateLimit("account", clientIp(request.headers)))) return tooMany();

  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { resumeKey: true },
  });
  if (profile?.resumeKey) {
    await resumeStore?.delete(profile.resumeKey);
    await db.candidateProfile.update({
      where: { userId: user.id },
      data: { resumeKey: null, resumeFilename: null, resumeSize: null, resumeType: null, resumeUpdatedAt: null },
    });
  }
  return new NextResponse(null, { status: 204 });
}
