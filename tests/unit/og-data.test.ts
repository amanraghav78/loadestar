import { describe, expect, it } from "vitest";
import { companyOgContent, jobOgContent, titleFontSize, truncate } from "@/lib/og-data";

const job = {
  title: "Senior Backend Engineer",
  status: "ACTIVE" as const,
  location: "Bengaluru",
  remote: "HYBRID" as const,
  remoteRegion: null,
  salaryMin: 2_500_000,
  salaryMax: 3_500_000,
  currency: "INR" as const,
  company: { name: "Acme" },
};

describe("truncate", () => {
  it("leaves short text alone and tidies whitespace", () => {
    expect(truncate("  Data   Engineer ", 40)).toBe("Data Engineer");
  });

  it("cuts long text at a word, drops trailing punctuation and adds an ellipsis", () => {
    const out = truncate("Principal Software Engineer, Distributed Systems and Storage Infrastructure", 40);
    expect(out).toBe("Principal Software Engineer…");
    expect(out.length).toBeLessThanOrEqual(40);
  });

  it("doesn't end on a separator", () => {
    expect(truncate("Remote (India) · Bengaluru · Pune · Hyderabad", 44)).toBe("Remote (India) · Bengaluru · Pune…");
  });

  it("cuts mid-word when there is no word break nearby", () => {
    expect(truncate("Supercalifragilisticexpialidocious", 10)).toBe("Supercali…");
  });
});

describe("titleFontSize", () => {
  it("shrinks as titles grow", () => {
    const sizes = [10, 40, 60, 90].map((n) => titleFontSize("x".repeat(n)));
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBe(4);
  });
});

describe("jobOgContent", () => {
  it("prints the published band, the location and the company", () => {
    expect(jobOgContent(job)).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme",
      location: "Hybrid · Bengaluru",
      salary: "₹25–35 LPA",
      open: true,
      alt: "Senior Backend Engineer at Acme: ₹25–35 LPA, Hybrid · Bengaluru. On Lodestar.",
    });
  });

  it("leaves pay out when the employer didn't publish it", () => {
    const content = jobOgContent({ ...job, salaryMin: null, salaryMax: null, currency: null });
    expect(content.salary).toBeNull();
    expect(content.alt).toBe("Senior Backend Engineer at Acme: Hybrid · Bengaluru. On Lodestar.");
  });

  it("marks closed and expired roles", () => {
    for (const status of ["CLOSED", "EXPIRED"] as const) {
      const content = jobOgContent({ ...job, status });
      expect(content.open).toBe(false);
      expect(content.alt).toContain("(no longer open)");
    }
  });

  it("keeps very long titles within bounds", () => {
    const content = jobOgContent({ ...job, title: "Engineer ".repeat(30) });
    expect(content.title.length).toBeLessThanOrEqual(90);
    expect(content.titleSize).toBe(titleFontSize(content.title));
  });
});

describe("companyOgContent", () => {
  it("counts open roles", () => {
    expect(companyOgContent({ name: "acme", openRoles: 1 })).toMatchObject({
      initial: "A",
      roles: "1 open role",
      alt: "acme on Lodestar. 1 open role.",
    });
    expect(companyOgContent({ name: "Acme", openRoles: 1200 }).roles).toBe("1,200 open roles");
    expect(companyOgContent({ name: "Acme", openRoles: 0 }).roles).toBe("No open roles right now");
  });
});
