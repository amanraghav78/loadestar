import { describe, expect, it } from "vitest";
import { reviewResume, scoreVerdict, type AtsStatus } from "@/lib/ats-check";
import { EMPTY_RESUME, type ResumeContact, type ResumeContent } from "@/lib/resume-builder";

const contact: ResumeContact = {
  fullName: "Priya Sharma",
  email: "priya@example.com",
  phone: "+919811122333",
  city: "Hyderabad",
  linkedinUrl: "https://www.linkedin.com/in/priyasharma",
  githubUrl: null,
  portfolioUrl: null,
};

const good: ResumeContent = {
  headline: "Senior Data Engineer",
  summary:
    "Data engineer with nine years building batch and streaming pipelines in Python and Scala, most recently for " +
    "payments risk teams. Looking for a senior role on a platform team in Hyderabad or remote.",
  skills: ["Python", "Spark", "Airflow", "Snowflake", "Kafka", "dbt", "AWS"],
  experience: [
    {
      role: "Senior Data Engineer",
      company: "Acme Analytics",
      location: "Hyderabad",
      start: "2020-03",
      end: "",
      current: true,
      bullets: [
        "Built Spark and Airflow pipelines landing 40 TB a day into Snowflake",
        "Cut pipeline cost 35% by moving the Kafka ingestion layer off EMR",
        "Led three engineers through a dbt migration over two quarters",
      ],
    },
  ],
  projects: [],
  education: [
    {
      degree: "B.Tech, Computer Science",
      institution: "NIT Warangal",
      location: "",
      start: "2013",
      end: "2017",
      detail: "",
    },
  ],
  certifications: [],
};

const statusOf = (content: ResumeContent, id: string, who: ResumeContact = contact): AtsStatus =>
  reviewResume(content, who).checks.find((check) => check.id === id)!.status;

describe("reviewing a resume", () => {
  it("passes a complete one, and says so", () => {
    const report = reviewResume(good, contact);
    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.checks.every((check) => check.status === "pass")).toBe(true);
    expect(report.pages).toBe(1);
    expect(scoreVerdict(report.score)).toBe("Ready to send");
  });

  it("scores an empty one at zero and asks for the things that matter most", () => {
    const report = reviewResume(EMPTY_RESUME, contact);
    expect(report.score).toBeLessThan(45);
    expect(statusOf(EMPTY_RESUME, "experience")).toBe("fail");
    expect(statusOf(EMPTY_RESUME, "skills")).toBe("fail");
  });

  it("every check says what to do about it", () => {
    for (const check of reviewResume(EMPTY_RESUME, contact).checks) {
      expect(check.detail.length).toBeGreaterThan(20);
    }
  });

  it("notices a role with no dates on it", () => {
    const undated = { ...good, experience: [{ ...good.experience[0], start: "", current: false }] };
    expect(statusOf(undated, "experience")).toBe("warn");
  });

  it("notices bullets that don't start with a verb", () => {
    const passive = {
      ...good,
      experience: [
        {
          ...good.experience[0],
          bullets: [
            "Responsible for the Spark pipelines that landed 40 TB a day",
            "Worked on the Kafka ingestion layer with 35% less cost",
            "Was part of the dbt migration across 3 teams",
          ],
        },
      ],
    };
    expect(statusOf(passive, "verbs")).toBe("fail");
    // The numbers are still there, so that check is unaffected.
    expect(statusOf(passive, "metrics")).toBe("pass");
  });

  it("notices bullets with nothing measured in them", () => {
    const vague = {
      ...good,
      experience: [
        {
          ...good.experience[0],
          bullets: ["Built Spark pipelines", "Led a dbt migration", "Owned the ingestion layer"],
        },
      ],
    };
    expect(statusOf(vague, "metrics")).toBe("fail");
  });

  it("counts a role with a single bullet as thin", () => {
    const thin = { ...good, experience: [{ ...good.experience[0], bullets: ["Built Spark pipelines for 40 teams"] }] };
    expect(statusOf(thin, "bullets")).toBe("warn");
  });

  it("asks for the profile fields it needs rather than inventing them", () => {
    const nameless: ResumeContact = { ...contact, phone: null, city: null };
    expect(statusOf(good, "contact", nameless)).toBe("fail");
    expect(reviewResume(good, nameless).checks.find((c) => c.id === "contact")!.detail).toContain("profile");
    expect(statusOf(good, "links", { ...contact, linkedinUrl: null })).toBe("warn");
  });

  it("warns about characters the PDF can't print", () => {
    expect(statusOf({ ...good, summary: `${good.summary} 🚀` }, "characters")).toBe("warn");
    expect(statusOf(good, "characters")).toBe("pass");
  });

  it("recognises skills in the vocabulary the job feeds are tagged with", () => {
    const report = reviewResume(good, contact);
    expect(report.recognisedSkills).toEqual(expect.arrayContaining(["Python", "Spark", "Airflow", "Kafka"]));

    // Spelled in a way no posting spells it: listed, but not matchable.
    const odd = { ...good, skills: ["Pythonn", "Sparkk", "Airfloww", "Kafkaa", "Snowflakee", "DBTT"] };
    expect(statusOf(odd, "skills")).toBe("warn");
  });

  it("warns when the resume runs past two pages", () => {
    const sprawling: ResumeContent = {
      ...good,
      experience: Array.from({ length: 14 }, (_, i) => ({
        ...good.experience[0],
        company: `Employer ${i}`,
        bullets: Array.from({ length: 6 }, (_, j) => `Shipped release ${i}.${j} and cut latency by 20% doing it`),
      })),
    };
    const report = reviewResume(sprawling, contact);
    expect(report.pages).toBeGreaterThan(2);
    expect(statusOf(sprawling, "length")).toBe("warn");
  });

  it("points each problem at the field that fixes it", () => {
    const at = (content: ResumeContent, id: string) =>
      reviewResume(content, contact).checks.find((check) => check.id === id)!;

    const weak: ResumeContent = {
      ...good,
      experience: [
        good.experience[0]!,
        { ...good.experience[0]!, company: "Beta", start: "", bullets: ["Responsible for reports"] },
      ],
    };
    expect(at(weak, "experience").field).toBe("experience-1-start");
    expect(at(weak, "verbs").field).toBe("experience-1-bullets");
    expect(at(EMPTY_RESUME, "experience").field).toBe("add-experience");
    expect(at(EMPTY_RESUME, "summary").field).toBe("summary");

    // Contact details are edited on the profile, not here.
    expect(at(good, "contact")).toMatchObject({ href: "/account" });
    expect(at(good, "contact").field).toBeUndefined();
  });
});
