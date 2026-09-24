import { describe, expect, it } from "vitest";
import { buildSearchText, formatJobLocation, formatPostedAgo, formatSalaryBand, slugify } from "@/lib/format";

describe("formatSalaryBand", () => {
  it("formats bands in the listing currency without decimals", () => {
    expect(formatSalaryBand(95_000, 125_000, "EUR")).toBe("€95,000 – €125,000");
    expect(formatSalaryBand(72_000, 88_000, "GBP")).toBe("£72,000 – £88,000");
    expect(formatSalaryBand(110_000, 140_000, "USD")).toBe("US$110,000 – US$140,000");
  });
});

describe("formatSalaryBand (INR)", () => {
  it("quotes Indian salaries in LPA / crore", () => {
    expect(formatSalaryBand(2_500_000, 3_500_000, "INR")).toBe("₹25–35 LPA");
    expect(formatSalaryBand(4_408_400, 4_408_400, "INR")).toBe("₹44.1 LPA");
    expect(formatSalaryBand(8_000_000, 12_000_000, "INR")).toBe("₹80 L – ₹1.2 Cr");
  });

  it("returns null when pay isn't disclosed", () => {
    expect(formatSalaryBand(null, null, null)).toBeNull();
  });
});

describe("formatPostedAgo", () => {
  const now = new Date("2026-09-21T12:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it.each([
    [0, "Today"],
    [1, "Yesterday"],
    [2, "2 days ago"],
    [7, "1 week ago"],
    [20, "2 weeks ago"],
    [40, "1 month ago"],
    [95, "3 months ago"],
  ])("%i days → %s", (days, expected) => {
    expect(formatPostedAgo(ago(days), now)).toBe(expected);
  });

  it("never reports the future", () => {
    expect(formatPostedAgo(new Date(now.getTime() + 86_400_000), now)).toBe("Today");
  });
});

describe("formatJobLocation", () => {
  it("describes remote, hybrid and on-site roles", () => {
    expect(formatJobLocation({ location: "India", remote: "REMOTE", remoteRegion: "India" })).toBe("Remote (India)");
    expect(formatJobLocation({ location: "Pune", remote: "REMOTE", remoteRegion: "India" })).toBe(
      "Remote (India) · Pune",
    );
    expect(formatJobLocation({ location: "London", remote: "HYBRID", remoteRegion: null })).toBe("Hybrid · London");
    expect(formatJobLocation({ location: "Utrecht", remote: "ONSITE", remoteRegion: null })).toBe("Utrecht");
  });
});

describe("slugify / buildSearchText", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Senior Backend Engineer, Ingest — Arclight")).toBe("senior-backend-engineer-ingest-arclight");
    expect(slugify("Café Zürich")).toBe("cafe-zurich");
  });

  it("builds lowercase search text including company and tags", () => {
    expect(
      buildSearchText({ title: "Staff  Engineer", companyName: "Arclight", location: "Berlin", tags: ["Go", "Kafka"] }),
    ).toBe("staff engineer arclight berlin go kafka");
  });
});
