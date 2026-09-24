import { describe, expect, it } from "vitest";
import {
  EMPTY_RESUME,
  formatDateRange,
  formatResumeDate,
  layoutResume,
  type ResumeContact,
  type ResumeContent,
} from "@/lib/resume-builder";
import { parseResumeContent, resumeContentSchema } from "@/lib/validators";

const contact: ResumeContact = {
  fullName: "Priya Sharma",
  email: "priya@example.com",
  phone: "+919811122333",
  city: "Hyderabad",
  linkedinUrl: "https://www.linkedin.com/in/priyasharma",
  githubUrl: null,
  portfolioUrl: null,
};

const content: ResumeContent = {
  ...EMPTY_RESUME,
  headline: "Senior Data Engineer",
  summary: "Nine years of pipelines.",
  skills: ["Python", "Spark"],
  experience: [
    {
      role: "Senior Data Engineer",
      company: "Acme Analytics",
      location: "Hyderabad",
      start: "2020-03",
      end: "",
      current: true,
      bullets: ["Built Spark pipelines", "", "Owned the Kafka layer"],
    },
  ],
  education: [
    {
      degree: "B.Tech, Computer Science",
      institution: "NIT Warangal",
      location: "",
      start: "2013",
      end: "2017",
      detail: "CGPA 8.7",
    },
  ],
};

describe("resume dates", () => {
  it("reads what a month input gives and what a person types", () => {
    expect(formatResumeDate("2021-03")).toBe("Mar 2021");
    expect(formatResumeDate("2021-12")).toBe("Dec 2021");
    expect(formatResumeDate("2021")).toBe("2021");
    // Nothing we recognise is left exactly as written rather than guessed at.
    expect(formatResumeDate(" Summer 2022 ")).toBe("Summer 2022");
    expect(formatResumeDate("2021-13")).toBe("2021-13");
    expect(formatResumeDate("")).toBe("");
  });

  it("joins a range, and says Present for a job someone still has", () => {
    expect(formatDateRange("2020-03", "2022-06")).toBe("Mar 2020 – Jun 2022");
    expect(formatDateRange("2020-03", "", true)).toBe("Mar 2020 – Present");
    expect(formatDateRange("", "2022")).toBe("2022");
    expect(formatDateRange("", "")).toBe("");
  });
});

describe("laying a resume out", () => {
  const blocks = layoutResume(content, contact);
  const kinds = blocks.map((b) => b.kind);
  const text = (kind: string) => blocks.filter((b) => b.kind === kind).map((b) => b.text);

  it("opens with the name, the target role and one contact line", () => {
    expect(blocks[0]).toEqual({ kind: "name", text: "Priya Sharma" });
    expect(blocks[1]).toEqual({ kind: "headline", text: "Senior Data Engineer" });
    expect(text("contact")[0]).toBe("Hyderabad · +919811122333 · priya@example.com");
  });

  it("writes links without their scheme, and skips the ones nobody gave us", () => {
    expect(text("contact")[1]).toBe("linkedin.com/in/priyasharma");
  });

  it("uses the section headings a parser looks for, in reading order", () => {
    expect(text("heading")).toEqual(["Summary", "Skills", "Experience", "Education"]);
    // Skills before the roles: it is the section keyword filters read first.
    expect(kinds.indexOf("heading")).toBeLessThan(kinds.indexOf("entryTitle"));
  });

  it("keeps skills on one line rather than in columns", () => {
    expect(text("text")).toContain("Python, Spark");
  });

  it("drops empty bullets instead of printing a blank line", () => {
    expect(text("bullet")).toEqual(["Built Spark pipelines", "Owned the Kafka layer"]);
  });

  it("prints the employer, the place and the dates together", () => {
    expect(text("entryTitle")).toContain("Senior Data Engineer · Acme Analytics");
    expect(text("entryMeta")).toContain("Hyderabad · Mar 2020 – Present");
    expect(text("entryMeta")).toContain("2013 – 2017 · CGPA 8.7");
  });

  it("leaves out a section nobody filled in", () => {
    expect(text("heading")).not.toContain("Projects");
    const nobody: ResumeContact = {
      fullName: "",
      email: "",
      phone: null,
      city: null,
      linkedinUrl: null,
      githubUrl: null,
      portfolioUrl: null,
    };
    expect(layoutResume(EMPTY_RESUME, nobody)).toEqual([]);
  });
});

describe("what a saved document accepts", () => {
  it("keeps the sections it understands and tidies what it keeps", () => {
    const parsed = resumeContentSchema.parse({
      headline: "  Backend Engineer  ",
      summary: "Six years on payments.",
      skills: ["React", "react", " Node.js ", ""],
      experience: [{ role: "Engineer", company: "Acme", current: "on", bullets: ["Did a thing", "  "] }],
      projects: "not a list",
    });

    expect(parsed.headline).toBe("Backend Engineer");
    // Deduplicated case-insensitively, keeping the spelling they typed first.
    expect(parsed.skills).toEqual(["React", "Node.js"]);
    expect(parsed.experience[0].current).toBe(true);
    // A line left blank in the bullets box is not a bullet.
    expect(parsed.experience[0].bullets).toEqual(["Did a thing"]);
    // A section that arrived as something other than a list is simply absent.
    expect(parsed.projects).toEqual([]);
  });

  it("refuses text longer than a resume holds, rather than silently cutting it", () => {
    expect(resumeContentSchema.safeParse({ ...EMPTY_RESUME, summary: "x".repeat(3000) }).success).toBe(false);
  });

  it("reads a row it can't make sense of as an empty resume, rather than throwing", () => {
    expect(parseResumeContent(null)).toEqual(EMPTY_RESUME);
    expect(parseResumeContent({ experience: [{ role: "x".repeat(500) }] })).toEqual(EMPTY_RESUME);
  });
});
