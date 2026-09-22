import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
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
  await db.candidateProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      fullName: user.name,
      resumeKey: key,
      resumeFilename: filename,
      resumeSize: bytes.length,
      resumeType: RESUME_TYPE,
      resumeUpdatedAt: new Date(),
    },
    update: {
      resumeKey: key,
      resumeFilename: filename,
      resumeSize: bytes.length,
      resumeType: RESUME_TYPE,
      resumeUpdatedAt: new Date(),
    },
  });

  // Replacing a resume removes the old file, or "we deleted it" stops being true.
  if (previous?.resumeKey && previous.resumeKey !== key) {
    try {
      await resumeStore.delete(previous.resumeKey);
    } catch (err) {
      console.error("could not remove the replaced resume", previous.resumeKey, err);
    }
  }

  return NextResponse.json({ filename, size: bytes.length, updatedAt: new Date().toISOString() });
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
