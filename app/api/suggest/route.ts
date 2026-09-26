import { NextResponse, type NextRequest } from "next/server";
import { getSuggestVocabulary } from "@/lib/queries";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { suggest } from "@/lib/suggest";
import { suggestParamsSchema } from "@/lib/validators";

/**
 * GET /api/suggest?field=q|location&term=… — search-box completions.
 *
 * The vocabulary is built once an hour from active listings (cached, and
 * dropped with the jobs tag); each request only matches in memory and sends
 * back at most eight short entries. The answer depends on the URL alone, so
 * browsers and the CDN may keep it for a few minutes.
 */
export async function GET(request: NextRequest) {
  if (!(await rateLimit("suggest", clientIp(request.headers)))) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
    );
  }

  const { searchParams } = request.nextUrl;
  const parsed = suggestParamsSchema.safeParse({
    field: searchParams.get("field") ?? undefined,
    term: searchParams.get("term") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const vocab = await getSuggestVocabulary();
  const items = suggest(vocab, parsed.data.field, parsed.data.term);
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
