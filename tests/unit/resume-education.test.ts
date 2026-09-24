import { describe, expect, it } from "vitest";
import { findEducation, parseResumeText } from "@/lib/resume-parse";

/**
 * Education is the hardest part of a resume to read: every candidate lays it
 * out differently. As with the rest of the parser, a wrong guess costs the
 * candidate more than a missing one, so the second half of this file — what it
 * must *not* claim — matters more than the first.
 */

const NOW = new Date("2026-09-25T00:00:00Z");
const lines = (text: string) => text.split("\n").map((l) => l.trim());

describe("findEducation", () => {
  it("reads a typical Indian B.Tech entry", () => {
    expect(
      findEducation(lines("Education\nB.Tech, Computer Science\nIIT Bombay, 2017 - 2021\nCGPA 8.7/10"), NOW),
    ).toMatchObject({
      educationLevel: "BACHELORS",
      degree: "B.Tech",
      institution: "IIT Bombay",
      graduationYear: 2021,
    });
  });

  it("reads a degree and college written on one line", () => {
    expect(findEducation(lines("Bachelor of Engineering, Pune Institute of Technology, 2019"), NOW)).toMatchObject({
      educationLevel: "BACHELORS",
      institution: "Pune Institute of Technology",
      graduationYear: 2019,
    });
  });

  it("keeps the highest qualification when several are listed", () => {
    const found = findEducation(
      lines("EDUCATION\nB.Tech Mechanical Engineering\nNIT Trichy, 2015\nM.Tech Robotics\nIIT Madras, 2018"),
      NOW,
    );
    expect(found.educationLevel).toBe("MASTERS");
    expect(found.graduationYear).toBe(2018);
  });

  it.each([
    ["MBA, Finance | IIM Ahmedabad | 2020", "MASTERS"],
    ["Ph.D. in Computer Science, IISc Bangalore (2022)", "DOCTORATE"],
    ["Diploma in Electrical Engineering, Government Polytechnic, 2014", "DIPLOMA"],
    ["Class 12 (CBSE), Delhi Public School, 2013", "HIGH_SCHOOL"],
  ])("recognises %s", (line, level) => {
    expect(findEducation(lines(line), NOW).educationLevel).toBe(level);
  });

  it("takes an expected graduation year in the future", () => {
    expect(findEducation(lines("B.Sc Statistics, Christ University, 2024 - 2027"), NOW).graduationYear).toBe(2027);
  });

  // ---- what it must not do -------------------------------------------------

  it("finds nothing in a resume with no education section", () => {
    expect(findEducation(lines("Senior Backend Engineer\nBengaluru\nSkills: Go, Kubernetes"), NOW)).toEqual({});
  });

  it("does not read a year far beyond a plausible graduation", () => {
    expect(findEducation(lines("B.Tech, VIT Vellore, 2045"), NOW).graduationYear).toBeUndefined();
  });

  it("does not mistake an employer for a college", () => {
    const found = findEducation(lines("B.Tech, Computer Science\nInfosys Limited, 2018"), NOW);
    expect(found.institution).toBeUndefined();
  });

  it("leaves the degree off when the line is a bare heading", () => {
    // "Education" alone is a heading, not a qualification.
    expect(findEducation(lines("Education\nSkills"), NOW)).toEqual({});
  });

  it("keeps marks and dates out of the degree", () => {
    const { degree } = findEducation(lines("B.Tech Information Technology 2016-2020 CGPA: 9.1"), NOW);
    expect(degree).toBe("B.Tech Information Technology");
  });
});

describe("parseResumeText with education", () => {
  it("suggests education alongside the rest of the profile", () => {
    const parsed = parseResumeText(
      `Priya Sharma
Data Scientist
Hyderabad, India

Education
M.Sc Data Science
University of Hyderabad, 2021

Skills
Python, SQL, Pandas`,
      NOW,
    );
    expect(parsed).toMatchObject({ educationLevel: "MASTERS", graduationYear: 2021 });
    expect(parsed.institution).toContain("University of Hyderabad");
  });

  it("omits the keys entirely when there is no education to report", () => {
    const parsed = parseResumeText("Rohit Verma\nProduct Manager\nMumbai\n\nSkills\nSQL, Figma", NOW);
    expect("educationLevel" in parsed).toBe(false);
    expect("graduationYear" in parsed).toBe(false);
  });
});
