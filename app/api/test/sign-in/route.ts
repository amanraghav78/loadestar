import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth, testAuthEnabled } from "@/lib/auth";

/**
 * Signs a fixture candidate in for the end-to-end suite, because Google's
 * consent screen can't be automated.
 *
 * Off unless E2E_TEST_AUTH=1 and we are not in production, and it answers 404
 * rather than 403 so it gives nothing away when it is off. Better Auth mints
 * the session itself, so the cookie is signed exactly like a real one.
 */
const bodySchema = z.object({
  email: z.email().endsWith(".test"),
  name: z.string().min(1).max(80).default("Test Candidate"),
  password: z.string().min(12).max(100),
});

export async function POST(request: NextRequest) {
  if (!testAuthEnabled) return new NextResponse("Not found", { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse("Bad request", { status: 400 });
  const { email, name, password } = parsed.data;

  const credentials = { body: { email, password }, asResponse: true } as const;
  const signedIn = await auth.api.signInEmail(credentials).catch(() => null);
  if (signedIn?.ok) return signedIn;

  return auth.api.signUpEmail({ body: { email, password, name }, asResponse: true });
}
