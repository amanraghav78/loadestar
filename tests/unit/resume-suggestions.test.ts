import { describe, expect, it } from "vitest";
import { newExperience } from "@/lib/resume-builder";
import {
  bulletHints,
  bulletListHints,
  educationHints,
  experienceHints,
  headlineHint,
  skillsHint,
  startsWithVerb,
  summaryHint,
} from "@/lib/resume-suggestions";

const texts = (hints: { text: string }[]) => hints.map((h) => h.text);

describe("bulletHints", () => {
  it("says nothing about a strong bullet", () => {
    expect(bulletHints("Cut checkout latency 40% by rewriting the settlement job in Go")).toEqual([]);
  });

  it("names a weak opener and offers verbs", () => {
    const [first] = bulletHints("Responsible for the payments service used by 2M merchants");
    expect(first?.text).toMatch(/“Responsible for” says you were near the work/);
  });

  it("drops a leading I", () => {
    expect(texts(bulletHints("I rebuilt the search index for 3 markets"))).toContain(
      "Drop the “I” and start with the verb.",
    );
  });

  it("asks for a number, and flags lines too long or too short", () => {
    expect(texts(bulletHints("Built the onboarding flow for the merchant dashboard"))[0]).toMatch(/^Add a number/);
    expect(texts(bulletHints(`Built ${"a very long line ".repeat(15)} 10`)).join(" ")).toMatch(/past two lines/);
    expect(texts(bulletHints("Built 2 APIs"))).toContain("Short. Say what came of it.");
  });

  it("ignores blank lines", () => {
    expect(bulletHints("   ")).toEqual([]);
  });

  it("stops asking for numbers once half the bullets have one", () => {
    const lines = bulletListHints([
      "Cut latency 40% on the checkout service",
      "Built the merchant onboarding flow in React",
    ]);
    expect(lines[1]).toEqual([]);
  });

  it("shares its verb list with the ATS check", () => {
    expect(startsWithVerb("Shipped UPI autopay")).toBe(true);
    expect(startsWithVerb("Worked on UPI autopay")).toBe(false);
  });
});

describe("experienceHints", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const role = { ...newExperience(), role: "Backend Engineer", company: "Razorpay" };

  it("says nothing about a role not started", () => {
    expect(experienceHints(newExperience(), now).dates).toBeUndefined();
  });

  it("asks for the dates a role is missing", () => {
    expect(experienceHints(role, now).dates?.text).toMatch(/start date/);
    expect(experienceHints({ ...role, start: "2021-03" }, now).dates?.text).toMatch(/end date/);
    expect(experienceHints({ ...role, start: "2021-03", current: true }, now).dates).toBeUndefined();
  });

  it("catches dates the wrong way round, or in the future", () => {
    expect(experienceHints({ ...role, start: "2022-01", end: "2021-01" }, now).dates?.text).toMatch(/before/);
    expect(experienceHints({ ...role, start: "2027-01", current: true }, now).dates?.tone).toBe("warn");
  });

  it("asks for bullets, and for fewer when there are too many", () => {
    expect(experienceHints(role, now).bullets?.tone).toBe("fail");
    const many = Array.from({ length: 7 }, (_, i) => `Shipped feature ${i + 1} to 10k users`);
    expect(experienceHints({ ...role, bullets: many }, now).bullets?.text).toMatch(/Keep the best five/);
  });
});

describe("field hints", () => {
  it("nudges an Indian education entry for the year and the CGPA or percentage", () => {
    const entry = { degree: "B.Tech", institution: "", location: "", start: "", end: "", detail: "" };
    expect(educationHints(entry).end).toBeDefined();
    expect(educationHints(entry).detail?.text).toMatch(/CGPA/);
    expect(educationHints({ ...entry, detail: "8.2" }).detail?.text).toMatch(/Say what the number is/);
    expect(educationHints({ ...entry, end: "2021", detail: "78%" })).toEqual({});
  });

  it("wants a headline that is a job title", () => {
    expect(headlineHint("")?.tone).toBe("fail");
    expect(headlineHint("Backend Engineer")).toBeUndefined();
    expect(headlineHint("x".repeat(80))?.tone).toBe("warn");
  });

  it("keeps the summary to a few lines without “I”", () => {
    expect(summaryHint("")).toBeUndefined();
    expect(summaryHint("Engineer.")?.text).toMatch(/characters/);
    expect(summaryHint(`I am a backend engineer ${"with years on payments ".repeat(8)}`)?.text).toMatch(/skip “I”/);
  });

  it("wants six to twenty skills, each a name", () => {
    expect(skillsHint([])).toBeUndefined();
    expect(skillsHint(["Go", "SQL"])?.text).toMatch(/2 listed/);
    expect(skillsHint(["a", "b", "c", "d", "e", "f"])).toBeUndefined();
  });
});
