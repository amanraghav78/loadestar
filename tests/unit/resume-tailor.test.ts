import { describe, expect, it } from "vitest";
import { EMPTY_RESUME, newExperience, type ResumeContent } from "@/lib/resume-builder";
import { jobKeywords, keywordGap, type JobForTailoring } from "@/lib/resume-tailor";

const job: JobForTailoring = {
  slug: "senior-backend-engineer-acme",
  title: "Senior Backend Engineer",
  companyName: "Acme",
  tags: ["Go", "Kafka", "PostgreSQL"],
  description: "You will build services in Go on Kubernetes, with Kafka and PostgreSQL. Docker experience helps.",
};

const resume: ResumeContent = {
  ...EMPTY_RESUME,
  headline: "Backend Engineer",
  skills: ["Go", "PostgreSQL"],
  experience: [
    {
      ...newExperience(),
      role: "Backend Engineer",
      company: "Razorpay",
      bullets: ["Moved the settlement pipeline onto Kafka, cutting lag 60%"],
    },
  ],
};

describe("jobKeywords", () => {
  it("starts with the posting's own tags and adds what its description names, once each", () => {
    const keywords = jobKeywords(job);
    expect(keywords.slice(0, 3)).toEqual(["Go", "Kafka", "PostgreSQL"]);
    expect(keywords).toEqual(expect.arrayContaining(["Kubernetes", "Docker"]));
    expect(new Set(keywords.map((k) => k.toLowerCase())).size).toBe(keywords.length);
  });
});

describe("keywordGap", () => {
  const gap = keywordGap(resume, job);

  it("splits the posting's keywords into covered and missing", () => {
    expect(gap.matched).toEqual(expect.arrayContaining(["Go", "Kafka", "PostgreSQL"]));
    expect(gap.missing).toEqual(expect.arrayContaining(["Kubernetes", "Docker"]));
    expect(gap.matched.length + gap.missing.length).toBe(gap.keywords.length);
    expect(gap.coverage).toBe(Math.round((gap.matched.length / gap.keywords.length) * 100));
  });

  it("points out a keyword that is in a bullet but not on the skills line", () => {
    expect(gap.notInSkills).toEqual(["Kafka"]);
  });

  it("matches the title on its meaningful words, not seniority", () => {
    expect(gap.titleMatches).toBe(true);
    expect(keywordGap({ ...resume, headline: "Product Designer" }, job).titleMatches).toBe(false);
  });

  it("does not count a keyword inside another word", () => {
    const noGo = keywordGap({ ...EMPTY_RESUME, summary: "Good at Google Sheets and cargo logistics." }, job);
    expect(noGo.missing).toContain("Go");
  });

  it("is complete coverage for a posting with no keywords", () => {
    expect(keywordGap(resume, { ...job, tags: [], title: "", description: "" }).coverage).toBe(100);
  });
});
