import { NextResponse, type NextRequest } from "next/server";
import { getJobsByIds } from "@/lib/queries";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { idsParamSchema } from "@/lib/validators";

/** GET /api/jobs?ids=a,b,c — hydrates the saved-roles list kept in localStorage. */
export async function GET(request: NextRequest) {
  if (!(await rateLimit("api", clientIp(request.headers)))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const parsed = idsParamSchema.safeParse(request.nextUrl.searchParams.get("ids") ?? "");
  if (!parsed.success) return NextResponse.json({ error: "invalid_ids" }, { status: 400 });

  const jobs = await getJobsByIds(parsed.data);
  return NextResponse.json({ jobs }, { headers: { "Cache-Control": "private, max-age=60" } });
}
