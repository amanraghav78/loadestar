import { describe, expect, it } from "vitest";
import { filterHref } from "@/components/job-filters";
import type { Level } from "@/lib/generated/prisma/enums";
import {
  EXPERIENCE_BUCKET_KEYS,
  experienceWhere,
  formatExperience,
  LEVEL_EXPERIENCE,
  levelsInBucket,
  rangeInBucket,
  type ExperienceBucket,
  type YearsRange,
} from "@/lib/experience";
import { normalizePosting, parseExperience, rehash } from "@/lib/ingest/normalize";
import type { RawPosting } from "@/lib/ingest/sources";
import { experienceRequirementsJsonLd } from "@/lib/structured-data";
import { jobInputSchema, parseSearchParams, recruiterJobSchema, toQueryString } from "@/lib/validators";

// ---------------------------------------------------------------- parser

describe("parseExperience", () => {
  const open = (min: number) => ({ min, max: null });
  const range = (min: number, max: number) => ({ min, max });

  it.each<[string, string, YearsRange]>([
    // "N+" and the ways it's qualified
    ["plus", "We need 3+ years of experience with Java or Kotlin.", open(3)],
    ["plus after the unit", "Candidates with 4 years+ experience in Spring Boot preferred.", open(4)],
    ["yrs and exp", "10+ yrs exp in Java, microservices and AWS.", open(10)],
    ["minimum", "Minimum 4 years of experience in data engineering.", open(4)],
    ["minimum of", "A minimum of 6 years of professional experience.", open(6)],
    ["at least, spelled out", "You have at least two years of experience shipping React apps.", open(2)],
    ["or more", "5 or more years of experience running production Kubernetes.", open(5)],
    ["apostrophe", "5 years' experience building distributed systems.", open(5)],
    ["decimal", "Must have 2.5+ years of hands-on experience with Python.", open(2)],
    ["label with plus", "Experience Required: 4+ Yrs", open(4)],
    ["a single figure", "Experience: 5 years in B2B SaaS sales engineering.", open(5)],
    // ranges
    ["hyphen", "3-5 yrs of experience in backend development.", range(3, 5)],
    ["spaced hyphen", "3 - 6 years experience in Android development using Kotlin.", range(3, 6)],
    ["en dash", "Experience: 0–1 year", range(0, 1)],
    ["to", "Experience: 5 to 8 years", range(5, 8)],
    ["dash label, Title Case", "Experience – 6 to 9 Years", range(6, 9)],
    ["exp label", "Exp: 2-4 yrs", range(2, 4)],
    ["between", "Between 3 and 6 years of experience in a product company.", range(3, 6)],
    ["up to", "Up to 2 years of experience; freshers can apply.", range(0, 2)],
    ["word numbers", "Two to four years of experience with Figma.", range(2, 4)],
    ["the first figure wins", "Overall 8-12 years of experience, with 3+ years managing teams.", range(8, 12)],
    // no "experience", but plainly about it
    ["building", "4+ years building web applications with React and TypeScript.", open(4)],
    ["in a role", "5+ years in a product design role at a consumer company.", open(5)],
    ["relevant", "Bachelor's degree in CS and 6+ years of relevant work in fintech.", open(6)],
    // a label line with the figure beneath it
    ["label line", "## Experience\n\n- 7-10 years", range(7, 10)],
    // skips an unrelated figure in the same sentence
    ["age first", "Age: 21-28 years, experience 2+ years in customer support.", open(2)],
    ["degree first", "A 4-year degree and 3+ years of experience with SQL.", open(3)],
    // freshers
    ["freshers welcome", "Freshers welcome! Strong fundamentals in data structures required.", range(0, 1)],
    ["freshers encouraged", "Freshers are encouraged to apply.", range(0, 1)],
    ["open to freshers", "This role is open to freshers from any engineering stream.", range(0, 1)],
    ["experience: fresher", "Experience: Fresher", range(0, 1)],
    ["numbers beat fresher", "Freshers need not apply. 3+ years of experience required.", open(3)],
  ])("reads %s", (_, description, expected) => {
    expect(parseExperience("Software Engineer", description)).toEqual(expected);
  });

  it.each<[string, YearsRange]>([
    ["Backend Developer (3-5 Years)", range(3, 5)],
    ["Senior Data Engineer | 10+ yrs", open(10)],
    ["Frontend Engineer - 2 to 4 yrs - Bengaluru", range(2, 4)],
    ["Graduate Engineer Trainee (Freshers)", range(0, 1)],
    ["Software Engineer - Fresher", range(0, 1)],
  ])("reads the title %s", (title, expected) => {
    expect(parseExperience(title, "Founded 12 years ago, we build payments software.")).toEqual(expected);
  });

  it("prefers the title over the description", () => {
    expect(parseExperience("Engineer (2-4 yrs)", "We need 6+ years of experience.")).toEqual(range(2, 4));
  });

  it.each([
    ["founded", "Founded 10 years ago, we build payments infrastructure for India."],
    ["warranty", "All devices come with 2 years of warranty."],
    ["degree", "Requires a 4-year degree in Computer Science."],
    ["the company's experience", "With over 20 years of experience in payments, we serve 5 million merchants."],
    ["combined", "Our team has 50+ years of combined experience."],
    ["in business", "We have been in business for 15 years."],
    ["age of the company", "We are a 10-year-old company with deep experience in fintech."],
    ["program length", "The program runs for 2 years."],
    ["bond", "Service agreement: minimum 2 years bond."],
    ["vesting", "Equity vests over 4 years with a 1 year cliff."],
    ["age limit", "Age limit 21-28 years."],
    ["leave policy", "Paid sabbatical after 5 years of service."],
    ["salary", "CTC 12-18 LPA plus benefits. Experience with Kafka is a plus."],
    ["no figure", "Experience with Kubernetes and Terraform. We ship 2 releases a year."],
    ["freshers refused", "Not suitable for freshers."],
    ["no freshers", "No freshers please."],
    ["implausible range", "0-25 years of experience."],
    ["inverted range", "5-3 years of experience."],
    ["nothing", ""],
  ])("ignores %s", (_, description) => {
    expect(parseExperience("Software Engineer", description)).toBeNull();
  });

  it("ignores a title figure that isn't experience", () => {
    expect(parseExperience("Engineer - 2 Year Contract", "")).toBeNull();
  });

  it("fills the columns during normalisation", () => {
    const posting: RawPosting = {
      externalId: "x1",
      title: "Backend Engineer",
      locations: ["Bengaluru, India"],
      workplace: null,
      department: "Engineering",
      description: "You will own payment APIs. We are looking for 3-5 years of experience with Go.",
      applyUrl: "https://example.com/jobs/x1",
      postedAt: new Date(Date.now() - 86_400_000),
      pay: null,
    };
    const r = normalizePosting(posting);
    if (!("job" in r)) throw new Error("expected a job");
    expect([r.job.experienceMin, r.job.experienceMax]).toEqual([3, 5]);

    // Derived from text that is hashed already, so it isn't hashed again: adding
    // the columns didn't change the hash of rows stored before them.
    expect(rehash({ ...r.job, experienceMin: null, experienceMax: null }).contentHash).toBe(r.job.contentHash);
  });
});

// ---------------------------------------------------------------- buckets

describe("rangeInBucket", () => {
  const bucketsOf = (range: YearsRange) => EXPERIENCE_BUCKET_KEYS.filter((b) => rangeInBucket(range, b));

  it.each<[string, YearsRange, ExperienceBucket[]]>([
    ["0-1", { min: 0, max: 1 }, ["0-1"]],
    ["0-2", { min: 0, max: 2 }, ["0-1", "1-3"]],
    ["1-3", { min: 1, max: 3 }, ["1-3"]],
    ["2-4", { min: 2, max: 4 }, ["1-3", "3-5"]],
    ["3-5", { min: 3, max: 5 }, ["3-5"]],
    ["3+", { min: 3, max: null }, ["3-5"]],
    ["4+", { min: 4, max: null }, ["3-5", "5-8"]],
    ["5-8", { min: 5, max: 8 }, ["5-8"]],
    ["6-10", { min: 6, max: 10 }, ["5-8", "8-plus"]],
    ["10+", { min: 10, max: null }, ["8-plus"]],
    ["exactly 3", { min: 3, max: 3 }, ["3-5"]],
  ])("puts a %s ask in the overlapping buckets", (_, range, expected) => {
    expect(bucketsOf(range)).toEqual(expected);
  });

  it("gives every level one or two buckets, so unknown years neither vanish nor flood", () => {
    for (const level of Object.keys(LEVEL_EXPERIENCE) as Level[]) {
      const n = EXPERIENCE_BUCKET_KEYS.filter((b) => levelsInBucket(b).includes(level)).length;
      expect(n, level).toBeGreaterThanOrEqual(1);
      expect(n, level).toBeLessThanOrEqual(2);
    }
    expect(levelsInBucket("0-1")).toEqual(["INTERN", "JUNIOR"]);
    expect(levelsInBucket("3-5")).toEqual(["MID"]);
    expect(levelsInBucket("5-8")).toEqual(["SENIOR"]);
    expect(levelsInBucket("8-plus")).toEqual(["STAFF", "PRINCIPAL", "MANAGER", "DIRECTOR"]);
  });
});

/**
 * Evaluates the subset of Prisma's where syntax experienceWhere uses, with
 * SQL's null semantics (a comparison with null is false), so the query can
 * be checked against rangeInBucket row by row.
 */
type Row = { experienceMin: number | null; experienceMax: number | null; level: Level };
function matches(where: Record<string, unknown>, row: Row): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "AND") return (cond as Record<string, unknown>[]).every((w) => matches(w, row));
    if (key === "OR") return (cond as Record<string, unknown>[]).some((w) => matches(w, row));
    const value = row[key as keyof Row];
    if (cond === null) return value === null;
    const ops = cond as Record<string, unknown>;
    return Object.entries(ops).every(([op, arg]) => {
      if (op === "not") return arg === null ? value !== null : value !== arg;
      if (op === "in") return (arg as unknown[]).includes(value);
      if (value === null) return false;
      const [v, a] = [value as number, arg as number];
      return op === "lt" ? v < a : op === "lte" ? v <= a : op === "gt" ? v > a : op === "gte" ? v >= a : v === a;
    });
  });
}

describe("experienceWhere", () => {
  const levels = Object.keys(LEVEL_EXPERIENCE) as Level[];
  const rows: Row[] = [];
  for (let min = 0; min <= 14; min++) {
    rows.push({ experienceMin: min, experienceMax: null, level: "MID" });
    for (let max = min; max <= min + 8; max++) rows.push({ experienceMin: min, experienceMax: max, level: "MID" });
  }
  for (const level of levels) rows.push({ experienceMin: null, experienceMax: null, level });

  it.each(EXPERIENCE_BUCKET_KEYS)("selects exactly the rows rangeInBucket puts in %s", (bucket) => {
    const where = experienceWhere(bucket) as Record<string, unknown>;
    for (const row of rows) {
      const expected =
        row.experienceMin === null
          ? rangeInBucket(LEVEL_EXPERIENCE[row.level], bucket)
          : rangeInBucket({ min: row.experienceMin, max: row.experienceMax }, bucket);
      expect(matches(where, row), JSON.stringify(row)).toBe(expected);
    }
  });

  it("uses the level only when the years are unknown", () => {
    const senior3to5 = { experienceMin: 3, experienceMax: 5, level: "SENIOR" as const };
    expect(matches(experienceWhere("3-5") as Record<string, unknown>, senior3to5)).toBe(true);
    expect(matches(experienceWhere("5-8") as Record<string, unknown>, senior3to5)).toBe(false);
  });
});

// ---------------------------------------------------------------- URL

describe("the exp search param", () => {
  it("keeps a known bucket", () => {
    expect(parseSearchParams({ exp: "3-5" }).exp).toBe("3-5");
    expect(parseSearchParams({ exp: "8-plus" }).exp).toBe("8-plus");
  });

  it.each(["3-6", "8+", "senior", "", "0-1; drop table"])("drops %j and filters nothing", (exp) => {
    expect(parseSearchParams({ exp }).exp).toBeUndefined();
  });

  it("takes the first of repeated values, and keeps the other filters", () => {
    expect(parseSearchParams({ exp: ["1-3", "8-plus"], q: "go", discipline: "DATA" })).toMatchObject({
      exp: "1-3",
      q: "go",
      discipline: "DATA",
    });
  });

  it("is written back to the URL with the rest of the search", () => {
    const params = parseSearchParams({ q: "backend", city: "Pune", sort: "salary", exp: "5-8" });
    expect(toQueryString(params)).toBe("?q=backend&exp=5-8&city=Pune&sort=salary");
  });

  it("toggles from the sidebar, keeping the search and order and starting from page one", () => {
    const query = (href: string) => Object.fromEntries(new URL(href, "https://x.test").searchParams);
    const params = parseSearchParams({
      q: "backend",
      discipline: "ENGINEERING",
      sort: "salary",
      cursor: "cm0abc123def456",
    });
    expect(query(filterHref(params, "exp", "3-5"))).toEqual({
      q: "backend",
      discipline: "ENGINEERING",
      exp: "3-5",
      sort: "salary",
    });
    expect(filterHref(parseSearchParams({ q: "backend", exp: "3-5" }), "exp", "3-5")).toBe("/jobs?q=backend");
    expect(filterHref(parseSearchParams({ exp: "3-5" }), "exp", "1-3")).toBe("/jobs?exp=1-3");
  });
});

// ---------------------------------------------------------------- display

describe("formatExperience", () => {
  it.each<[number | null, number | null, string | null]>([
    [3, 5, "3–5 yrs"],
    [0, 1, "0–1 yr"],
    [5, null, "5+ yrs"],
    [2, 2, "2 yrs"],
    [1, 1, "1 yr"],
    [null, null, null],
  ])("%s–%s → %s", (min, max, expected) => {
    expect(formatExperience(min, max)).toBe(expected);
  });
});

describe("experienceRequirementsJsonLd", () => {
  it("gives the minimum in months, 'no requirements' for freshers, and nothing when unknown", () => {
    expect(experienceRequirementsJsonLd(3)).toEqual({
      experienceRequirements: { "@type": "OccupationalExperienceRequirements", monthsOfExperience: 36 },
    });
    expect(experienceRequirementsJsonLd(0)).toEqual({ experienceRequirements: "no requirements" });
    expect(experienceRequirementsJsonLd(null)).toEqual({});
  });
});

// ---------------------------------------------------------------- forms

describe("experience on the job forms", () => {
  const job = {
    title: "Backend Engineer",
    companyId: "cm0abc123def456",
    description: "A real description that is long enough.",
    discipline: "ENGINEERING",
    level: "MID",
    tags: "Go",
    location: "Bengaluru",
    remote: "ONSITE",
    salaryMin: "2500000",
    salaryMax: "4000000",
    currency: "INR",
    applyUrl: "https://example.com/careers/1",
  };
  const errors = (schema: typeof jobInputSchema | typeof recruiterJobSchema, extra: object) => {
    const r = schema.safeParse({ ...job, ...extra });
    return r.success ? null : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  };

  it("is optional, and a minimum alone is an open range", () => {
    expect(jobInputSchema.parse({ ...job, experienceMin: "", experienceMax: "" })).toMatchObject({
      experienceMin: undefined,
      experienceMax: undefined,
    });
    expect(jobInputSchema.parse({ ...job, experienceMin: "3", experienceMax: "" })).toMatchObject({
      experienceMin: 3,
      experienceMax: undefined,
    });
    expect(recruiterJobSchema.parse({ ...job, experienceMin: "0", experienceMax: "1" })).toMatchObject({
      experienceMin: 0,
      experienceMax: 1,
    });
  });

  it.each([jobInputSchema, recruiterJobSchema])(
    "rejects a maximum alone, an inverted range and odd numbers",
    (schema) => {
      expect(errors(schema, { experienceMax: "5" })).toEqual(["experienceMin: Give a minimum too (0 for freshers)"]);
      expect(errors(schema, { experienceMin: "5", experienceMax: "3" })).toEqual([
        "experienceMax: Maximum must be at least the minimum",
      ]);
      expect(errors(schema, { experienceMin: "-1" })).toEqual(["experienceMin: Years can't be negative"]);
      expect(errors(schema, { experienceMin: "2.5" })).toEqual(["experienceMin: Use whole years"]);
      expect(errors(schema, { experienceMin: "45" })).toEqual(["experienceMin: That looks too high"]);
      expect(errors(schema, { experienceMin: "lots" })).toEqual(["experienceMin: Enter a number of years"]);
    },
  );
});
