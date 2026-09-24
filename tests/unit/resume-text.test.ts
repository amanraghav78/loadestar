import { describe, expect, it } from "vitest";
import { parseResumeText } from "@/lib/resume-parse";
import { extractResumeText } from "@/lib/resume-text";
import { resumePdf, SAMPLE_RESUME } from "../resume-pdf";

/**
 * The one test that goes through the real PDF reader rather than a string, so
 * a change in unpdf (or in how we hand it bytes) can't quietly turn resume
 * parsing off in production while every other test still passes.
 */

const bytesOf = (lines: string[]) => new Uint8Array(resumePdf(lines));

describe("reading a real PDF", () => {
  it("extracts the text and fills a profile from it", async () => {
    const text = await extractResumeText(bytesOf(SAMPLE_RESUME));
    expect(text).not.toBeNull();

    const parsed = parseResumeText(text!, new Date("2026-09-25T00:00:00Z"));
    expect(parsed.fullName).toBe("Priya Sharma");
    expect(parsed.currentTitle).toBe("Senior Data Engineer");
    expect(parsed.city).toBe("Hyderabad");
    expect(parsed.phone).toBe("+919811122333");
    expect(parsed.yearsExperience).toBe(9);
    expect(parsed.currentSalary).toBe(3_800_000);
    expect(parsed.expectedSalary).toBe(5_000_000);
    expect(parsed.noticePeriod).toBe(60);
    expect(parsed.linkedinUrl).toBe("https://linkedin.com/in/priyasharma");
    expect(parsed.githubUrl).toBe("https://github.com/priyas");
    expect(parsed.skills).toEqual(expect.arrayContaining(["Python", "Spark", "Airflow", "Snowflake", "Kafka"]));
  });

  it("reads nothing out of a PDF with no text layer, rather than failing", async () => {
    // A scanned resume: a valid PDF whose text is a picture.
    expect(await extractResumeText(bytesOf(["Scanned."]))).toBeNull();
  });

  it("leaves the caller's bytes intact, so the file can still be stored", async () => {
    const bytes = bytesOf(SAMPLE_RESUME);
    const before = bytes.slice(0, 16);
    await extractResumeText(bytes);
    expect(bytes.slice(0, 16)).toEqual(before);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
