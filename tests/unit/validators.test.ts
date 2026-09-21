import { describe, expect, it } from "vitest";
import { idsParamSchema, jobInputSchema, parseSearchParams, toQueryString } from "@/lib/validators";

describe("parseSearchParams", () => {
  it("keeps valid filters", () => {
    expect(parseSearchParams({ q: "  go  ", discipline: "ENGINEERING", minSalary: "80000", remote: "REMOTE" })).toMatchObject({
      q: "go",
      discipline: "ENGINEERING",
      minSalary: 80000,
      remote: "REMOTE",
    });
  });

  it("drops invalid values instead of throwing", () => {
    const parsed = parseSearchParams({ discipline: "COOKING", minSalary: "lots", cursor: "'; drop table" });
    expect(parsed.discipline).toBeUndefined();
    expect(parsed.minSalary).toBeUndefined();
    expect(parsed.cursor).toBeUndefined();
  });

  it("uses the first value of repeated params", () => {
    expect(parseSearchParams({ q: ["react", "vue"] }).q).toBe("react");
  });

  it("round-trips through toQueryString", () => {
    expect(toQueryString({ q: "design systems", tag: undefined, minSalary: 60000 })).toBe("?q=design+systems&minSalary=60000");
    expect(toQueryString({})).toBe("");
  });
});

describe("jobInputSchema", () => {
  const valid = {
    title: "Senior Backend Engineer",
    companyId: "cm0abc123def456",
    description: "A real description that is long enough.",
    discipline: "ENGINEERING",
    level: "SENIOR",
    tags: "Go, Kafka, Go, ",
    location: "Berlin",
    remote: "ONSITE",
    remoteRegion: "",
    salaryMin: "95000",
    salaryMax: "125000",
    currency: "EUR",
    applyUrl: "https://forms.gle/abc",
  };

  it("accepts a complete listing and normalises tags", () => {
    const r = jobInputSchema.parse(valid);
    expect(r.tags).toEqual(["Go", "Kafka"]);
    expect(r.salaryMin).toBe(95000);
    expect(r.featured).toBe(false);
    expect(r.remoteRegion).toBeUndefined();
  });

  it("rejects a listing without a salary band", () => {
    expect(jobInputSchema.safeParse({ ...valid, salaryMin: "" }).success).toBe(false);
  });

  it("rejects an inverted band", () => {
    const r = jobInputSchema.safeParse({ ...valid, salaryMin: "130000", salaryMax: "90000" });
    expect(r.success).toBe(false);
  });

  it("only allows http(s) apply links", () => {
    expect(jobInputSchema.safeParse({ ...valid, applyUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(jobInputSchema.safeParse({ ...valid, applyUrl: "ftp://example.com" }).success).toBe(false);
  });
});

describe("idsParamSchema", () => {
  it("keeps only well-formed ids", () => {
    expect(idsParamSchema.parse("cm0abc123def456,bad id,../x,cm0xyz987uvw654")).toEqual(["cm0abc123def456", "cm0xyz987uvw654"]);
  });
});
