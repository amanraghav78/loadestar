import { describe, expect, it } from "vitest";
import {
  buildVocabulary,
  cleanTitle,
  highlightRange,
  matchTier,
  normalize,
  suggest,
  titleKey,
  type SuggestVocabulary,
} from "@/lib/suggest";
import { suggestParamsSchema } from "@/lib/validators";

const job = (title: string, location = "Bengaluru, India", tags: string[] = [], remote = "ONSITE") => ({
  title,
  tags,
  location,
  remote,
});

const vocab: SuggestVocabulary = buildVocabulary(
  [
    job("Backend Engineer", "Bengaluru, India", ["Go", "Kafka"]),
    job("Backend Engineer - Bengaluru", "Bengaluru", ["Go"]),
    job("Backend Engineer (Remote)", "Remote", ["Node.js"], "REMOTE"),
    job("Sr. Backend Engineer", "Pune", ["Go"]),
    job("Senior Backend Engineer", "Gurugram, Haryana", ["Java"]),
    job("Senior Frontend Engineer", "Mumbai", ["React"]),
    job("Data Scientist", "Hyderabad", ["Python"]),
    job("Engineering Manager, Payments", "Noida", ["Leadership"]),
    job("Head of Backoffice", "Delhi", []),
    job("C++ Developer", "Chennai", ["C++"]),
  ],
  [
    { name: "Razorpay", slug: "razorpay", openRoles: 4 },
    { name: "Backbase", slug: "backbase", openRoles: 1 },
    { name: "Ghost Co", slug: "ghost", openRoles: 0 },
  ],
);

describe("normalising titles", () => {
  it("lowercases, strips accents and keeps C++ / C# / Node.js", () => {
    expect(normalize("  Café & Bar ")).toBe("cafe and bar");
    expect(normalize("C++ / C# Dev")).toBe("c++ c# dev");
    expect(normalize("Node.js.")).toBe("node.js");
  });

  it("drops bracketed notes and a trailing place, but keeps team names", () => {
    expect(cleanTitle("Backend Engineer (Remote)")).toBe("Backend Engineer");
    expect(cleanTitle("Backend Engineer - Bengaluru")).toBe("Backend Engineer");
    expect(cleanTitle("SRE, Remote - India")).toBe("SRE");
    expect(cleanTitle("Product Designer, Payouts")).toBe("Product Designer, Payouts");
  });

  it("merges abbreviated variants onto one key", () => {
    expect(titleKey("Sr. Backend Engineer")).toBe(titleKey("Senior Backend Engineer"));
    expect(titleKey("Backend Engineer - Pune")).toBe(titleKey("backend engineer"));
  });
});

describe("building the vocabulary", () => {
  it("merges title variants and weights them by all their jobs", () => {
    const backend = vocab.q.filter((e) => e.kind === "title" && e.key === "backend engineer");
    expect(backend).toHaveLength(1);
    expect(backend[0]).toMatchObject({ label: "Backend Engineer", count: 3 });
    expect(vocab.q.find((e) => e.key === "senior backend engineer")?.count).toBe(2);
  });

  it("leaves out companies with no open roles", () => {
    expect(vocab.q.some((e) => e.label === "Ghost Co")).toBe(false);
  });

  it("lists only cities with jobs, plus Remote", () => {
    const labels = vocab.location.map((e) => e.label);
    expect(labels).toContain("Bengaluru");
    expect(labels).toContain("Remote");
    expect(labels).not.toContain("Kolkata");
    expect(vocab.location[0].label).toBe("Bengaluru");
  });
});

describe("matching", () => {
  it("ranks a prefix above a word start", () => {
    expect(matchTier("backend engineer", "back")).toBe(0);
    expect(matchTier("senior backend engineer", "back")).toBe(1);
    expect(matchTier("senior backend engineer", "backend senior")).toBe(2);
    expect(matchTier("senior backend engineer", "ackend")).toBeNull();
  });

  it("suggests titles, companies and skills, prefix matches first", () => {
    const items = suggest(vocab, "q", "back");
    expect(items[0]).toMatchObject({ k: "title", v: "Backend Engineer", m: [0, 4] });
    expect(items.find((i) => i.k === "company")).toMatchObject({ v: "Backbase", s: "backbase" });
    const senior = items.findIndex((i) => i.v === "Senior Backend Engineer");
    const prefixed = items.filter((i) => i.v.toLowerCase().startsWith("back")).length;
    expect(senior).toBeGreaterThanOrEqual(prefixed);
    expect(items.find((i) => i.v === "Senior Backend Engineer")?.m).toEqual([7, 11]);
  });

  it("puts an exact match first and understands abbreviations", () => {
    expect(suggest(vocab, "q", "razorpay")[0]).toMatchObject({ k: "company", v: "Razorpay", s: "razorpay" });
    expect(suggest(vocab, "q", "sr backend")[0]).toMatchObject({ v: "Senior Backend Engineer" });
    expect(suggest(vocab, "q", "c++").map((i) => [i.k, i.v])).toEqual([
      ["skill", "C++"],
      ["title", "C++ Developer"],
    ]);
  });

  it("offers skills with their own kind", () => {
    expect(suggest(vocab, "q", "kaf")).toEqual([{ k: "skill", v: "Kafka", m: [0, 3] }]);
  });

  it("caps the list", () => {
    const many = buildVocabulary(
      Array.from({ length: 30 }, (_, i) => job(`Engineer ${i}`)),
      [],
    );
    expect(suggest(many, "q", "eng")).toHaveLength(8);
    expect(suggest(many, "q", "eng", 3)).toHaveLength(3);
  });

  it("suggests nothing for an empty keyword, and the busiest places for an empty city", () => {
    expect(suggest(vocab, "q", "  ")).toEqual([]);
    expect(suggest(vocab, "location", "")[0]).toEqual({ k: "city", v: "Bengaluru" });
  });

  it("highlights the typed part of the label", () => {
    expect(highlightRange("Senior Backend Engineer", "back")).toEqual([7, 11]);
    expect(highlightRange("Backend Engineer", "BACK")).toEqual([0, 4]);
    expect(highlightRange("Backend Engineer", "zzz")).toBeUndefined();
  });
});

describe("city aliases", () => {
  it("maps old and informal names to the city", () => {
    expect(suggest(vocab, "location", "bangal")[0]).toMatchObject({ k: "city", v: "Bengaluru", a: "Bangalore" });
    expect(suggest(vocab, "location", "Gurgaon")[0]).toMatchObject({ v: "Gurugram", a: "Gurgaon" });
    expect(suggest(vocab, "location", "bombay")[0]).toMatchObject({ v: "Mumbai", a: "Bombay" });
  });

  it("answers NCR with each of its cities that has jobs", () => {
    const ncr = suggest(vocab, "location", "Delhi NCR").map((i) => i.v);
    expect(ncr).toEqual(expect.arrayContaining(["Gurugram", "Noida", "Delhi"]));
    expect(
      suggest(vocab, "location", "ncr")
        .map((i) => i.v)
        .sort(),
    ).toEqual(["Delhi", "Gurugram", "Noida"]);
  });

  it("highlights the city itself when it's typed directly", () => {
    expect(suggest(vocab, "location", "beng")[0]).toEqual({ k: "city", v: "Bengaluru", m: [0, 4] });
  });

  it("maps work-from-home to Remote", () => {
    expect(suggest(vocab, "location", "wfh")[0]).toMatchObject({ k: "remote", v: "Remote", a: "WFH" });
    expect(suggest(vocab, "location", "rem")[0]).toMatchObject({ k: "remote", v: "Remote" });
  });
});

describe("suggestParamsSchema", () => {
  it("accepts the two fields and trims the term", () => {
    expect(suggestParamsSchema.parse({ field: "q", term: "  back " })).toEqual({ field: "q", term: "back" });
    expect(suggestParamsSchema.parse({ field: "location" })).toEqual({ field: "location", term: "" });
  });

  it("takes the first of repeated params and cuts long terms", () => {
    expect(suggestParamsSchema.parse({ field: ["q", "location"], term: "x".repeat(500) })).toEqual({
      field: "q",
      term: "x".repeat(60),
    });
  });

  it("rejects an unknown or missing field", () => {
    expect(suggestParamsSchema.safeParse({ field: "company", term: "a" }).success).toBe(false);
    expect(suggestParamsSchema.safeParse({ term: "a" }).success).toBe(false);
  });
});
