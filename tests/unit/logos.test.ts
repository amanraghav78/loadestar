import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import bundled from "@/lib/company-logos.json";
import { companyLogo } from "@/lib/logos";

const dir = path.join(process.cwd(), "public", "logos");
const files = readdirSync(dir).filter((f) => f.endsWith(".webp"));

describe("companyLogo", () => {
  it("prefers a logo URL set in /admin", () => {
    expect(companyLogo({ slug: "stripe", logoUrl: "https://example.com/stripe.png" })).toBe("https://example.com/stripe.png");
  });

  it("falls back to the bundled tile, then to nothing", () => {
    expect(companyLogo({ slug: "stripe", logoUrl: null })).toBe("/logos/stripe.webp");
    expect(companyLogo({ slug: "no-such-company" })).toBeNull();
  });
});

describe("bundled logos", () => {
  it("lists exactly the files in public/logos", () => {
    expect([...bundled.slugs].sort()).toEqual(files.map((f) => f.replace(/\.webp$/, "")).sort());
  });

  it("stay small", () => {
    const sizes = files.map((f) => statSync(path.join(dir, f)).size);
    expect(Math.max(...sizes)).toBeLessThan(8 * 1024);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThan(600 * 1024);
  });
});
