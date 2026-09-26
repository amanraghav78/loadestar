import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { checkResumeBytes, MAX_RESUME_BYTES, RESUME_ERROR } from "@/lib/resume";
import { resumeFromText } from "@/lib/resume-prefill";
import { extractResumeText } from "@/lib/resume-text";
import { getUser } from "@/lib/session";
import { resumeStore } from "@/lib/storage";
import { resumeContentSchema } from "@/lib/validators";

/**
 * Reads a resume the candidate already has into the builder's sections, so
 * they start from their own words instead of a blank page.
 *
 * Two sources: a PDF posted with the request (read and thrown away — this
 * never stores it), or, with no file, the PDF already on their profile. Nothing
 * is saved here either way: the builder shows what was read, the candidate
 * checks it, and it is saved like anything else they type.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return new NextResponse("Sign in to continue", { status: 401 });
  if (!(await rateLimit("upload", clientIp(request.headers)))) {
    return NextResponse.json(
      { error: "Too many imports. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  let bytes: Uint8Array;

  if (file instanceof File) {
    // Refused before it is read into memory.
    if (file.size > MAX_RESUME_BYTES) return NextResponse.json({ error: RESUME_ERROR.too_large }, { status: 400 });
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    const profile = await db.candidateProfile.findUnique({
      where: { userId: user.id },
      select: { resumeKey: true },
    });
    const object = profile?.resumeKey && resumeStore ? await resumeStore.get(profile.resumeKey) : null;
    if (!object) return NextResponse.json({ error: "There is no resume on your profile to read." }, { status: 404 });
    bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
  }

  const rejection = checkResumeBytes(bytes);
  if (rejection) return NextResponse.json({ error: RESUME_ERROR[rejection] }, { status: 400 });

  let text: string | null = null;
  try {
    text = await extractResumeText(bytes);
  } catch (err) {
    console.error("could not read the resume to import", err);
  }
  if (!text) {
    return NextResponse.json(
      { error: "We couldn't read any text from that PDF — a scanned resume is a picture to us. Type it in instead." },
      { status: 422 },
    );
  }

  // Through the same bounds as a save, so what comes back is something the
  // builder can hold and the save action will accept.
  const parsed = resumeContentSchema.safeParse(resumeFromText(text));
  if (!parsed.success) {
    console.error("an imported resume fell outside the builder's bounds", parsed.error.issues.slice(0, 3));
    return NextResponse.json({ error: "We couldn't read that resume. Type it in instead." }, { status: 422 });
  }
  return NextResponse.json({ content: parsed.data });
}
