import { describe, expect, it } from "vitest";
import { measure, toPdfText, unrenderable, wrapText } from "@/lib/pdf/helvetica";
import { extractResumeText } from "@/lib/resume-text";
import { buildResumePdf, paginate, resumeFileName } from "@/lib/resume-pdf";
import { EMPTY_RESUME, layoutResume, type ResumeContact, type ResumeContent } from "@/lib/resume-builder";

/**
 * The claim this feature makes is that the file we hand a candidate can be read
 * by machine. So the test that matters reads it back with the same PDF library
 * the upload path uses (unpdf), and checks the words come out in order.
 */

const contact: ResumeContact = {
  fullName: "Priya Sharma",
  email: "priya@example.com",
  phone: "+91 98111 22333",
  city: "Hyderabad",
  linkedinUrl: "https://www.linkedin.com/in/priyasharma",
  githubUrl: "https://github.com/priyas",
  portfolioUrl: null,
};

const content: ResumeContent = {
  headline: "Senior Data Engineer",
  summary: "Data engineer with nine years building pipelines in Python and Scala for payments and risk teams.",
  skills: ["Python", "Spark", "Airflow", "Snowflake", "Kafka", "dbt"],
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
      ],
    },
    {
      role: "Data Engineer",
      company: "Initech",
      location: "Pune",
      start: "2017-07",
      end: "2020-02",
      current: false,
      bullets: ["Wrote ETL in Python against PostgreSQL and MongoDB"],
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

describe("folding text to what the built-in fonts can draw", () => {
  it("keeps the meaning of typography a word processor inserts", () => {
    expect(toPdfText("2020 – 2022")).toBe("2020 - 2022");
    expect(toPdfText("don’t")).toBe("don't");
    expect(toPdfText("₹18 LPA")).toBe("Rs 18 LPA");
    expect(toPdfText("José")).toBe("Jose");
  });

  it("names the characters it would have to drop, so the review can warn", () => {
    expect(unrenderable("Plain ASCII")).toEqual([]);
    expect(unrenderable("शर्मा")).not.toEqual([]);
    expect(unrenderable("Shipped 🚀")).toEqual(["🚀"]);
  });
});

describe("wrapping", () => {
  it("breaks on spaces, and keeps every line inside the width", () => {
    const text = "Built Spark and Airflow pipelines landing forty terabytes a day into Snowflake for the risk team";
    const lines = wrapText(text, "regular", 10, 200);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measure(line, "regular", 10)).toBeLessThanOrEqual(200);
    expect(lines.join(" ")).toBe(text);
  });

  it("splits a single word too long to fit rather than running it off the page", () => {
    const lines = wrapText("https://example.com/a/very/long/path/that/never/ends/at/all", "regular", 10, 60);
    for (const line of lines) expect(measure(line, "regular", 10)).toBeLessThanOrEqual(60);
    expect(lines.join("")).toContain("example.com");
  });
});

describe("the generated PDF", () => {
  it("is a PDF, and reads back as the resume that went in", async () => {
    const bytes = buildResumePdf(content, contact);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const text = await extractResumeText(bytes);
    expect(text).not.toBeNull();

    // Reading order, which is the whole point: an ATS takes the text layer as
    // it comes, so the sections have to arrive in the order they are printed.
    const flat = text!.replace(/\s+/g, " ");
    expect(flat).toContain("Priya Sharma");
    expect(flat).toContain("Senior Data Engineer");
    expect(flat).toContain("priya@example.com");
    expect(flat).toContain("linkedin.com/in/priyasharma");
    expect(flat).toContain("SUMMARY");
    expect(flat).toContain("Python, Spark, Airflow");
    expect(flat).toContain("Acme Analytics");
    expect(flat).toContain("Mar 2020 - Present");
    expect(flat).toContain("Jul 2017 - Feb 2020");
    expect(flat).toContain("NIT Warangal");
    expect(flat.indexOf("EXPERIENCE")).toBeLessThan(flat.indexOf("EDUCATION"));
  });

  it("fits a normal resume on one page", () => {
    expect(paginate(layoutResume(content, contact))).toHaveLength(1);
  });

  it("starts a second page rather than printing past the bottom", () => {
    const long: ResumeContent = {
      ...content,
      experience: Array.from({ length: 12 }, (_, i) => ({
        ...content.experience[0],
        company: `Employer ${i}`,
        bullets: Array.from({ length: 6 }, (_, j) => `Shipped the thing numbered ${i}-${j} and measured it at 99%`),
      })),
    };
    expect(paginate(layoutResume(long, contact)).length).toBeGreaterThan(1);
  });

  it("writes an empty resume without producing a broken file", async () => {
    const bytes = buildResumePdf(EMPTY_RESUME, contact);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(400);
  });

  it("names the file after the candidate, with nothing a filesystem would object to", () => {
    expect(resumeFileName("Priya Sharma")).toBe("Priya Sharma - Resume.pdf");
    expect(resumeFileName("../../etc/passwd")).toBe("etcpasswd - Resume.pdf");
    expect(resumeFileName("   ")).toBe("Resume - Resume.pdf");
  });
});
