import { describe, expect, it } from "vitest";
import { classifyEmploymentType } from "@/lib/ingest/classify";
import {
  applicationStageSchema,
  companyClaimSchema,
  moderationDecisionSchema,
  parseSearchParams,
  recruiterJobSchema,
  reviewInputSchema,
} from "@/lib/validators";

describe("classifyEmploymentType", () => {
  it.each([
    ["Software Engineer II", "FULL_TIME"],
    ["Senior Backend Engineer, Payments", "FULL_TIME"],
    ["Software Engineering Intern (Summer 2027)", "INTERNSHIP"],
    ["Data Science Intern", "INTERNSHIP"],
    ["Frontend Developer - Contract", "CONTRACT"],
    ["QA Consultant (C2H)", "CONTRACT"],
    ["Part-time Technical Writer", "PART_TIME"],
    ["Support Engineer (Fixed-term)", "TEMPORARY"],
  ])("%s → %s", (title, expected) => {
    expect(classifyEmploymentType(title)).toBe(expected);
  });

  it("does not read 'internal' as an internship", () => {
    expect(classifyEmploymentType("Engineer, Internal Tools")).toBe("FULL_TIME");
  });

  it("does not read 'temporal' or a product name as temporary", () => {
    expect(classifyEmploymentType("Backend Engineer, Temporal Workflows")).toBe("FULL_TIME");
  });
});

describe("search params for the new filters", () => {
  it("keeps a valid job type and industry", () => {
    expect(parseSearchParams({ employmentType: "INTERNSHIP", industry: "FINTECH" })).toMatchObject({
      employmentType: "INTERNSHIP",
      industry: "FINTECH",
    });
  });

  it("drops values that aren't in the enums", () => {
    const parsed = parseSearchParams({ employmentType: "GIG", industry: "AGRICULTURE" });
    expect(parsed.employmentType).toBeUndefined();
    expect(parsed.industry).toBeUndefined();
  });
});

const JOB = {
  title: "Senior Go Engineer",
  companyId: "clh1234567890",
  description: "We are hiring a senior engineer to work on our payments platform and its public API.",
  discipline: "ENGINEERING",
  level: "SENIOR",
  employmentType: "FULL_TIME",
  tags: "Go, Postgres",
  location: "Bengaluru",
  remote: "HYBRID",
  applyUrl: "https://example.com/careers/1",
  salaryMin: "2500000",
  salaryMax: "4000000",
  currency: "INR",
};

describe("recruiterJobSchema", () => {
  it("accepts a complete posting", () => {
    const parsed = recruiterJobSchema.safeParse(JOB);
    expect(parsed.success).toBe(true);
  });

  it("refuses a listing with no salary band", () => {
    const parsed = recruiterJobSchema.safeParse({ ...JOB, salaryMin: "", salaryMax: "" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.some((i) => i.path.includes("salaryMin"))).toBe(true);
  });

  it("refuses a band that runs backwards", () => {
    const parsed = recruiterJobSchema.safeParse({ ...JOB, salaryMin: "4000000", salaryMax: "2500000" });
    expect(parsed.success).toBe(false);
  });

  it("gives a recruiter no way to feature their own role", () => {
    const parsed = recruiterJobSchema.parse({ ...JOB, featured: "on" });
    expect("featured" in parsed).toBe(false);
  });
});

describe("companyClaimSchema", () => {
  it("accepts a work address", () => {
    const parsed = companyClaimSchema.safeParse({
      companyId: "clh1234567890",
      workEmail: " priya@vellum.com ",
      note: "Head of engineering",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.workEmail).toBe("priya@vellum.com");
  });

  it.each(["priya@gmail.com", "priya@yahoo.co.in", "priya@outlook.com", "priya@rediffmail.com"])(
    "refuses the personal address %s",
    (workEmail) => {
      const parsed = companyClaimSchema.safeParse({ companyId: "clh1234567890", workEmail });
      expect(parsed.success).toBe(false);
    },
  );

  it("refuses something that isn't an address at all", () => {
    expect(companyClaimSchema.safeParse({ companyId: "clh1234567890", workEmail: "priya at vellum" }).success).toBe(
      false,
    );
  });
});

describe("reviewInputSchema", () => {
  const REVIEW = {
    rating: "4",
    title: "Good engineering, slow decisions",
    pros: "Strong review culture and genuinely flexible hours for everyone on the team.",
    cons: "Roadmap changes often, and planning meetings can run for most of a morning.",
    roleTitle: "Backend engineer",
    stillThere: "on",
  };

  it("accepts a filled-in review", () => {
    const parsed = reviewInputSchema.safeParse(REVIEW);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ rating: 4, stillThere: true });
  });

  it.each([0, 6])("refuses a rating of %s", (rating) => {
    expect(reviewInputSchema.safeParse({ ...REVIEW, rating: String(rating) }).success).toBe(false);
  });

  it("asks for more than a couple of words", () => {
    expect(reviewInputSchema.safeParse({ ...REVIEW, pros: "good" }).success).toBe(false);
  });

  it("treats a missing checkbox as 'no longer there'", () => {
    const parsed = reviewInputSchema.parse({ ...REVIEW, stillThere: undefined });
    expect(parsed.stillThere).toBe(false);
  });
});

describe("moderationDecisionSchema", () => {
  const id = "clh1234567890";

  it("approves without a reason", () => {
    expect(moderationDecisionSchema.safeParse({ id, decision: "APPROVED" }).success).toBe(true);
  });

  it("insists on a reason for turning something down", () => {
    const parsed = moderationDecisionSchema.safeParse({ id, decision: "REJECTED" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.some((i) => i.path.includes("reviewNote"))).toBe(true);
  });

  it("accepts a refusal with a reason", () => {
    expect(
      moderationDecisionSchema.safeParse({ id, decision: "REJECTED", reviewNote: "No salary band given." }).success,
    ).toBe(true);
  });

  it("refuses a decision we don't have", () => {
    expect(moderationDecisionSchema.safeParse({ id, decision: "MAYBE" }).success).toBe(false);
  });
});

describe("applicationStageSchema", () => {
  it("accepts a stage the candidate chose", () => {
    expect(
      applicationStageSchema.safeParse({ jobId: "clh1234567890", stage: "INTERVIEWING", note: "Call on Tuesday" })
        .success,
    ).toBe(true);
  });

  it("refuses a stage that isn't one of ours", () => {
    expect(applicationStageSchema.safeParse({ jobId: "clh1234567890", stage: "HIRED" }).success).toBe(false);
  });
});
