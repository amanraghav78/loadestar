import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The password sign-in hook exists for the end-to-end suite only. If it ever
 * reached the live site, anyone could mint a session for any address.
 */
describe("the test-only sign-in hook", () => {
  const auth = readFileSync(path.join(process.cwd(), "lib/auth.ts"), "utf8");
  const testMode = readFileSync(path.join(process.cwd(), "lib/test-mode.ts"), "utf8");
  const route = readFileSync(path.join(process.cwd(), "app/api/test/sign-in/route.ts"), "utf8");

  it("needs the explicit flag and an environment that is not the live deployment", () => {
    expect(testMode).toContain('env.E2E_TEST_AUTH === "1"');
    expect(testMode).toContain('process.env.VERCEL_ENV !== "production"');
  });

  it("is what turns password sign-in on at all", () => {
    expect(auth).toContain("emailAndPassword: { enabled: testAuthEnabled }");
  });

  it("answers 404 when off, rather than advertising itself", () => {
    expect(route).toContain("if (!testAuthEnabled)");
    expect(route).toContain('new NextResponse("Not found", { status: 404 })');
  });
});
