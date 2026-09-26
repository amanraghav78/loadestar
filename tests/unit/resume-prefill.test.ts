import { describe, expect, it } from "vitest";
import { EMPTY_RESUME, newExperience, type ResumeContent } from "@/lib/resume-builder";
import {
  isBlankResume,
  mergeResume,
  mergeSkills,
  readRoleLine,
  resumeFromText,
  starterResume,
  toResumeDate,
} from "@/lib/resume-prefill";
import { SAMPLE_RESUME } from "../resume-pdf";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("starterResume", () => {
  it("opens on the profile's role, skills and highest qualification", () => {
    const content = starterResume({
      currentTitle: " Data Engineer ",
      skills: ["Python", "Spark"],
      degree: "B.Tech",
      institution: "NIT Warangal",
      graduationYear: 2017,
    });
    expect(content.headline).toBe("Data Engineer");
    expect(content.skills).toEqual(["Python", "Spark"]);
    expect(content.education).toEqual([
      { degree: "B.Tech", institution: "NIT Warangal", location: "", start: "", end: "2017", detail: "" },
    ]);
    expect(content.experience).toEqual([]);
  });

  it("is an empty resume without a profile, and never shares the empty resume's arrays", () => {
    const content = starterResume(null);
    expect(content).toEqual({ ...EMPTY_RESUME, skills: [], education: [] });
    content.skills.push("Go");
    expect(EMPTY_RESUME.skills).toEqual([]);
  });
});

describe("resumeFromText", () => {
  const content = resumeFromText(SAMPLE_RESUME.join("\n"), NOW);

  it("reads the summary without the salary lines", () => {
    expect(content.summary).toBe("Data engineer with 9 years of experience building pipelines in Python and Scala.");
  });

  it("reads each role with its employer, place and dates", () => {
    expect(content.experience).toHaveLength(2);
    expect(content.experience[0]).toMatchObject({
      role: "Senior Data Engineer",
      company: "Acme Analytics",
      location: "Hyderabad",
      start: "2020",
      current: true,
    });
    expect(content.experience[0]!.bullets).toEqual([
      "Built Spark and Airflow pipelines on AWS, landing into Snowflake.",
      "Owned the Kafka ingestion layer and the dbt models on top of it.",
    ]);
    expect(content.experience[1]).toMatchObject({
      role: "Data Engineer",
      company: "Initech",
      start: "2017",
      end: "2020",
      current: false,
    });
  });

  it("reads the education section and the skills it recognises", () => {
    expect(content.education[0]).toMatchObject({ institution: "NIT Warangal", start: "2013", end: "2017" });
    expect(content.education[0]!.degree).toMatch(/^B\.Tech/);
    expect(content.skills).toEqual(expect.arrayContaining(["Python", "Spark", "Kafka"]));
  });

  it("reads a CGPA or percentage off an Indian education line", () => {
    const edu = resumeFromText(
      ["Education", "B.E. Mechanical Engineering, Anna University, 2015 - 2019, CGPA: 8.4/10", "Class XII, 92%"].join(
        "\n",
      ),
      NOW,
    ).education;
    expect(edu[0]).toMatchObject({ detail: "CGPA 8.4/10", start: "2015", end: "2019" });
    expect(edu[1]).toMatchObject({ detail: "92%" });
  });

  it("invents nothing for text with no sections", () => {
    const empty = resumeFromText("", NOW);
    expect(empty.experience).toEqual([]);
    expect(empty.summary).toBe("");
  });
});

describe("parsing helpers", () => {
  it("reads the dates resumes are written in", () => {
    expect(toResumeDate("Mar 2020")).toBe("2020-03");
    expect(toResumeDate("Jan '22")).toBe("2022-01");
    expect(toResumeDate("06/2019")).toBe("2019-06");
    expect(toResumeDate("2017")).toBe("2017");
  });

  it("tells the title from the employer whichever comes first", () => {
    expect(readRoleLine("Acme | Backend Developer")).toEqual({
      role: "Backend Developer",
      company: "Acme",
      location: "",
    });
    expect(readRoleLine("Software Engineer at Initech, Pune")).toEqual({
      role: "Software Engineer",
      company: "Initech",
      location: "Pune",
    });
  });

  it("merges skills case-insensitively, keeping the first spelling", () => {
    expect(mergeSkills(["PostgreSQL", "go"], ["postgresql", "Go", "Kafka"])).toEqual(["PostgreSQL", "go", "Kafka"]);
  });
});

describe("mergeResume", () => {
  const imported = resumeFromText(SAMPLE_RESUME.join("\n"), NOW);

  it("fills an empty resume and says what it filled", () => {
    const { content, filled } = mergeResume(starterResume({ skills: ["Python"] }), imported);
    expect(content.experience).toHaveLength(2);
    expect(content.skills[0]).toBe("Python");
    expect(filled).toEqual(expect.arrayContaining(["summary", "2 roles"]));
  });

  it("never overwrites what the candidate wrote", () => {
    const mine: ResumeContent = {
      ...EMPTY_RESUME,
      headline: "Platform Engineer",
      summary: "My own words.",
      experience: [{ ...newExperience(), role: "Platform Engineer", company: "Globex" }],
    };
    const { content, filled } = mergeResume(mine, imported);
    expect(content.headline).toBe("Platform Engineer");
    expect(content.summary).toBe("My own words.");
    expect(content.experience).toEqual(mine.experience);
    expect(filled).not.toContain("summary");
  });

  it("knows a blank resume from a started one", () => {
    expect(isBlankResume(starterResume({ currentTitle: "SDE", skills: ["Java"] }))).toBe(true);
    expect(isBlankResume({ ...EMPTY_RESUME, summary: "Hi" })).toBe(false);
  });
});
