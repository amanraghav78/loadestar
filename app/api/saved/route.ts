import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { getUser } from "@/lib/session";

const id = z.string().regex(/^[a-z0-9]{10,40}$/i);

const bodySchema = z.object({
  /** One role just saved. */
  save: id.optional(),
  /** Roles just removed. */
  unsave: z.array(id).max(100).optional(),
  /** The one-time merge of roles saved before signing in. */
  merge: z.array(id).max(100).optional(),
});

/**
 * Keeps the account's saved roles in step with the browser's. Always scoped to
 * the caller, and idempotent, so a repeated or duplicated call is harmless.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return new NextResponse("Sign in to continue", { status: 401 });
  if (!(await rateLimit("account", clientIp(request.headers)))) {
    return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": "60" } });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse("Bad request", { status: 400 });
  const { save, unsave, merge } = parsed.data;

  const toAdd = [...(merge ?? []), ...(save ? [save] : [])];
  if (toAdd.length) {
    // Roles that have since been deleted are skipped rather than failing the call.
    const known = await db.job.findMany({ where: { id: { in: toAdd } }, select: { id: true } });
    if (known.length) {
      await db.savedJob.createMany({
        data: known.map((job) => ({ userId: user.id, jobId: job.id })),
        skipDuplicates: true,
      });
    }
  }
  if (unsave?.length) {
    await db.savedJob.deleteMany({ where: { userId: user.id, jobId: { in: unsave } } });
  }

  return NextResponse.json({ ok: true });
}
