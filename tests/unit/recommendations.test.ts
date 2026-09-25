import { describe, expect, it } from "vitest";
import {
  homeJobsView,
  levelsForExperience,
  matchingReadiness,
  rankJobs,
  scoreJob,
  type MatchProfile,
  type ScorableJob,
} from "@/lib/recommendations";

const job = (over: Partial<ScorableJob> = {}): ScorableJob => ({
  tags: ["Python", "AWS"],
  level: "SENIOR",
  location: "Bengaluru",
  remote: "ONSITE",
  salaryMin: null,
  salaryMax: null,
  currency: null,
  ...over,
});

const profile = (over: Partial<MatchProfile> = {}): MatchProfile => ({
  skills: ["Python", "AWS", "Kubernetes"],
  yearsExperience: 7,
  city: "Bengaluru",
  expectedSalary: 3_000_000,
  ...over,
});

describe("levelsForExperience", () => {
  it.each([
    [0, "INTERN"],
    [1, "JUNIOR"],
    [3, "MID"],
    [5, "SENIOR"],
    [8, "STAFF"],
    [12, "PRINCIPAL"],
    [20, "DIRECTOR"],
  ])("offers %i years a band including %s", (years, level) => {
    expect(levelsForExperience(years)).toContain(level);
  });

  it("does not offer a fresher a staff role", () => {
    expect(levelsForExperience(0)).not.toContain("STAFF");
  });

  it("does not offer a twenty-year veteran an internship", () => {
    expect(levelsForExperience(20)).not.toContain("INTERN");
  });

  it("filters nothing when we don't know how long they've worked", () => {
    expect(levelsForExperience(null)).toEqual([]);
  });
});

describe("scoreJob", () => {
  it("ranks a role asking for more of the candidate's skills higher", () => {
    const many = scoreJob(job({ tags: ["Python", "AWS", "Kubernetes"] }), profile());
    const one = scoreJob(job({ tags: ["Python", "Scala"] }), profile());
    expect(many.score).toBeGreaterThan(one.score);
    expect(many.matchedSkills).toEqual(["Python", "AWS", "Kubernetes"]);
  });

  it("scores nothing for skills the candidate doesn't have", () => {
    const { score, matchedSkills, reasons } = scoreJob(
      job({ tags: ["Scala", "Rust"] }),
      profile({ city: null, expectedSalary: null }),
    );
    expect(matchedSkills).toEqual([]);
    expect(reasons).toEqual([]);
    // Only the level match is left.
    expect(score).toBe(4);
  });

  it("matches skills whatever the casing", () => {
    expect(scoreJob(job({ tags: ["python"] }), profile({ skills: ["PYTHON"] })).matchedSkills).toEqual(["python"]);
  });

  it("rewards a role at the candidate's level", () => {
    const right = scoreJob(job({ level: "SENIOR" }), profile({ yearsExperience: 7 }));
    const wrong = scoreJob(job({ level: "INTERN" }), profile({ yearsExperience: 7 }));
    expect(right.score).toBeGreaterThan(wrong.score);
  });

  it("rewards a role in the candidate's city, and says so", () => {
    const here = scoreJob(job({ location: "Bengaluru, India" }), profile());
    const elsewhere = scoreJob(job({ location: "Chennai" }), profile());
    expect(here.score).toBeGreaterThan(elsewhere.score);
    expect(here.reasons).toContain("In Bengaluru");
  });

  it("rewards pay that meets what the candidate expects", () => {
    const enough = scoreJob(job({ salaryMin: 2_800_000, salaryMax: 3_500_000, currency: "INR" }), profile());
    const short = scoreJob(job({ salaryMin: 1_000_000, salaryMax: 1_500_000, currency: "INR" }), profile());
    expect(enough.score).toBeGreaterThan(short.score);
    expect(enough.reasons.some((r) => r.includes("₹"))).toBe(true);
  });

  it("does not compare a foreign salary band to an Indian expectation", () => {
    const usd = scoreJob(job({ salaryMin: 150_000, salaryMax: 200_000, currency: "USD" }), profile());
    expect(usd.reasons.some((r) => r.includes("₹"))).toBe(false);
  });

  it("explains itself in plain words", () => {
    const { reasons } = scoreJob(job({ tags: ["Python", "AWS", "Kubernetes"] }), profile());
    expect(reasons[0]).toBe("Python, AWS and 1 more match");
  });
});

describe("rankJobs", () => {
  const dated = (id: string, postedAt: string, over: Partial<ScorableJob> = {}) => ({
    id,
    postedAt: new Date(postedAt),
    ...job(over),
  });

  it("puts the strongest match first and keeps only the limit", () => {
    const jobs = [
      dated("weak", "2026-09-20", { tags: ["Scala"] }),
      dated("strong", "2026-09-01", { tags: ["Python", "AWS", "Kubernetes"] }),
      dated("middling", "2026-09-10", { tags: ["Python"] }),
    ];
    const ranked = rankJobs(jobs, profile(), 2);
    expect(ranked.map((r) => r.job.id)).toEqual(["strong", "middling"]);
    expect(ranked[0]!.match.matchedSkills).toEqual(["Python", "AWS", "Kubernetes"]);
  });

  it("breaks a tie in favour of the newer role", () => {
    const jobs = [dated("older", "2026-09-01"), dated("newer", "2026-09-20")];
    expect(rankJobs(jobs, profile(), 5).map((r) => r.job.id)).toEqual(["newer", "older"]);
  });

  it("hands back the rows it was given, so a job card can render them", () => {
    const row = dated("card", "2026-09-20");
    expect(rankJobs([row], profile(), 1)[0]!.job).toBe(row);
  });

  it("leaves the input alone, and copes with an empty shortlist or no room", () => {
    const jobs = [dated("a", "2026-09-01", { tags: ["Scala"] }), dated("b", "2026-09-20")];
    const before = jobs.map((j) => j.id);
    rankJobs(jobs, profile(), 5);
    expect(jobs.map((j) => j.id)).toEqual(before);
    expect(rankJobs([], profile(), 6)).toEqual([]);
    expect(rankJobs(jobs, profile(), 0)).toEqual([]);
  });
});

describe("homeJobsView", () => {
  it("shows a signed-out visitor the latest roles", () => {
    expect(homeJobsView({ signedIn: false, profile: null, matches: 0 })).toBe("latest");
  });

  it("shows a signed-in candidate their matches", () => {
    expect(homeJobsView({ signedIn: true, profile: profile(), matches: 6 })).toBe("recommended");
  });

  it("nudges a signed-in candidate with nothing to match on", () => {
    expect(homeJobsView({ signedIn: true, profile: profile({ skills: [] }), matches: 0 })).toBe("latest-nudge");
    expect(homeJobsView({ signedIn: true, profile: null, matches: 0 })).toBe("latest-nudge");
  });

  it("falls back to the latest roles, without nagging, when their skills match nothing open", () => {
    expect(homeJobsView({ signedIn: true, profile: profile(), matches: 0 })).toBe("latest");
  });
});

describe("matchingReadiness", () => {
  it("is not ready without skills, because skills carry the ranking", () => {
    const { ready, missing } = matchingReadiness(profile({ skills: [] }));
    expect(ready).toBe(false);
    expect(missing).toContain("your skills");
  });

  it("is ready on skills alone, and still asks for experience", () => {
    const { ready, missing } = matchingReadiness(profile({ yearsExperience: null }));
    expect(ready).toBe(true);
    expect(missing).toEqual(["your years of experience"]);
  });
});
