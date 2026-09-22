import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

/**
 * lib/queries.ts is cached with a plain "use cache", so every entry is shared
 * between all visitors. If anything per-user leaks in there, one candidate can
 * be served another's data. These are cheap guards on that boundary.
 */
describe("the shared job cache stays free of per-user data", () => {
  const queries = source("lib/queries.ts");

  it.each(["cookies", "headers", "userId", "@/lib/auth", "@/lib/session", "savedJob", "jobApplication"])(
    "lib/queries.ts does not mention %s",
    (needle) => {
      expect(queries).not.toContain(needle);
    },
  );

  it("account reads are not exported with a caller-supplied user id", () => {
    const accountQueries = source("lib/account-queries.ts");
    // Anything cached by user id stays module-private, so no caller can ask for
    // someone else's rows; the exported getters resolve the session themselves.
    const exportedWithUserId = /export\s+(?:async\s+)?function\s+\w+\s*\(\s*userId/.test(accountQueries);
    expect(exportedWithUserId).toBe(false);
  });

  it("the private session read never becomes a shared cache entry", () => {
    const session = source("lib/session.ts");
    expect(session).toContain('"use cache: private"');
    expect(session).not.toMatch(/"use cache"\s*;/);
  });
});
