import { describe, expect, it } from "vitest";
import { classifyDiscipline, classifyLevel, extractTags, indiaLocation } from "@/lib/ingest/classify";
import { htmlToText } from "@/lib/ingest/html";
import { dedupe, mergeLocations, normalizePosting } from "@/lib/ingest/normalize";
import { parseInrSalary } from "@/lib/ingest/salary";
import { workdayAgeDays, workdayIndiaFacet, type RawPosting } from "@/lib/ingest/sources";
import { companyInputSchema } from "@/lib/validators";

describe("parseInrSalary", () => {
  it.each([
    // Real formats seen in live feeds
    ["Annual base salary range (excluding equity and bonus): ₹9,424,500—₹9,424,500 INR", 9_424_500, 9_424_500],
    ["India Annual Pay Range ₹4,500,000—₹6,500,000 INR Reasonable Accommodations", 4_500_000, 6_500_000],
    // Common Indian notations
    ["CTC: ₹25,00,000 - ₹35,00,000 per annum", 2_500_000, 3_500_000],
    ["Compensation: 25-35 LPA", 2_500_000, 3_500_000],
    ["Salary range: INR 18L to 24L", 1_800_000, 2_400_000],
    ["The budget for this role is 30 to 45 lakhs per annum", 3_000_000, 4_500_000],
    ["Package: ₹80 L – ₹1.2 Cr", 8_000_000, 12_000_000],
    ["Fixed CTC of ₹18 LPA", 1_800_000, 1_800_000],
  ])("%s", (text, min, max) => {
    expect(parseInrSalary(text)).toEqual({ min, max });
  });

  it.each([
    // Real false positive from CRED's company blurb
    "credit accessible to millions across India. with loan offerings ranging from ₹50,000 to ₹5 Lakh",
    "We process over ₹10 crore to ₹20 crore in payments daily",
    "Stipend: ₹40,000 - ₹50,000 per month",
    "5 - 8 years of experience",
    "Pay Range: $153,000 — $376,000 USD",
    "Serving 10 crore users",
  ])("rejects: %s", (text) => {
    expect(parseInrSalary(text)).toBeNull();
  });
});

describe("indiaLocation", () => {
  it("finds Indian cities in multi-location strings", () => {
    expect(indiaLocation(["San Francisco, CA • Bengaluru, India"])).toEqual({ cities: ["Bengaluru"], remote: false });
    expect(indiaLocation(["Gurgaon", "Bangalore"])!.cities.sort()).toEqual(["Bengaluru", "Gurugram"]);
  });

  it("treats explicit Remote India as remote", () => {
    expect(indiaLocation(["Remote - India"])).toEqual({ cities: [], remote: true });
    expect(indiaLocation(["India (Remote)"])!.remote).toBe(true);
  });

  it("recognises cities outside the list via their state", () => {
    expect(indiaLocation(["Surat, Gujarat"])!.cities).toEqual(["Surat"]);
  });

  it("ignores non-Indian and worldwide remote roles", () => {
    expect(indiaLocation(["Chicago, Illinois; Indiana"])).toBeNull();
    expect(indiaLocation(["Remote - US", "Remote - APAC"])).toBeNull();
    expect(indiaLocation(["Singapore"])).toBeNull();
  });
});

describe("classifyDiscipline", () => {
  it.each([
    ["Senior Software Engineer", "ENGINEERING"],
    ["SDE II - Backend", "ENGINEERING"],
    ["Staff Software Engineer - Partner Ecosystem", "ENGINEERING"],
    ["Sr Full Stack Developer (AI Agents)", "ENGINEERING"],
    ["Data Scientist III", "DATA"],
    ["Director Data Science", "DATA"],
    ["Researcher, Vision", "DATA"],
    ["Senior Product Designer", "DESIGN"],
    ["Group Product Manager", "PRODUCT"],
    ["SIEM & SecOps Engineer II", "SECURITY"],
    ["Site Reliability Engineer", "INFRASTRUCTURE"],
  ])("%s → %s", (title, expected) => {
    expect(classifyDiscipline(title)).toBe(expected);
  });

  it.each([
    "Enterprise Account Executive",
    "Senior Solutions Architect",
    "Technical Services Engineer",
    "Client Onboarding Director, Inference and Agentic AI",
    "GTM Manager On-Device AI",
    "Corporate IT Architect",
    "Performance Marketing Manager",
  ])("excludes %s", (title) => {
    expect(classifyDiscipline(title)).toBeNull();
  });
});

describe("classifyLevel", () => {
  it.each([
    ["Software Engineer (CPD) - Winter Intern", "INTERN"],
    ["SDE I", "JUNIOR"],
    ["Software Engineer II", "MID"],
    ["Software Development Engineer III DevOps", "SENIOR"],
    ["Senior Backend Engineer", "SENIOR"],
    ["Staff Software Engineer", "STAFF"],
    ["Principal Software Engineer", "PRINCIPAL"],
    ["Engineering Manager", "MANAGER"],
    ["Senior Product Manager", "SENIOR"],
    ["Director of Engineering", "DIRECTOR"],
  ])("%s → %s", (title, expected) => {
    expect(classifyLevel(title)).toBe(expected);
  });
});

describe("extractTags", () => {
  it("finds proper-noun skills and ignores ordinary English", () => {
    const tags = extractTags("Backend Engineer (Go)", "Experience with Java, Go or Python. Kubernetes on AWS. We go fast.");
    expect(tags).toEqual(expect.arrayContaining(["Go", "Java", "Python", "Kubernetes", "AWS"]));
    expect(extractTags("Engineer", "Let's go and swift action, rust-free")).toEqual([]);
  });
});

describe("htmlToText", () => {
  it("converts board HTML to headings, paragraphs and bullet lists", () => {
    const html = "<h3>What you&rsquo;ll do</h3><p>Build &amp; ship.</p><ul><li>Own services</li><li>Mentor</li></ul><script>x</script>";
    expect(htmlToText(html)).toBe("## What you’ll do\n\nBuild & ship.\n\n- Own services\n- Mentor");
  });
});

describe("normalizePosting", () => {
  const base: RawPosting = {
    externalId: "1",
    title: "Senior Backend Engineer",
    locations: ["New York, NY", "Bengaluru, India"],
    workplace: null,
    department: "Engineering",
    description: "Pay Range: $180,000 — $220,000 USD. Build Kafka pipelines.",
    applyUrl: "https://example.com/jobs/1",
    postedAt: new Date(Date.now() - 2 * 86_400_000),
    pay: null,
  };

  it("never shows a foreign-currency band on an Indian role", () => {
    const r = normalizePosting(base);
    expect("job" in r && r.job.salaryMin).toBeNull();
  });

  it("uses a structured INR band when the board provides one", () => {
    const r = normalizePosting({ ...base, pay: { min: 3_000_000, max: 4_000_000, currency: "INR", interval: "1 YEAR" } });
    expect("job" in r && [r.job.salaryMin, r.job.salaryMax]).toEqual([3_000_000, 4_000_000]);
  });

  it("skips non-India and out-of-scope roles, and unsafe apply links", () => {
    expect(normalizePosting({ ...base, locations: ["London"] })).toEqual({ skip: "not_india" });
    expect(normalizePosting({ ...base, title: "Account Executive" })).toEqual({ skip: "not_in_scope" });
    expect(normalizePosting({ ...base, applyUrl: "javascript:alert(1)" })).toEqual({ skip: "bad_url" });
  });

  it("merges per-city duplicates into one listing", () => {
    const job = (p: RawPosting) => {
      const r = normalizePosting(p);
      if (!("job" in r)) throw new Error("expected a job");
      return r.job;
    };
    const merged = dedupe([
      job({ ...base, locations: ["Pune, India"] }),
      job({ ...base, externalId: "2", locations: ["Hyderabad, India"] }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.location).toBe("Pune · Hyderabad");
  });
});

describe("30-day window", () => {
  const recent: RawPosting = {
    externalId: "w1",
    title: "Software Engineer",
    locations: ["Pune, India"],
    workplace: null,
    department: null,
    description: "",
    applyUrl: "https://example.com/jobs/w1",
    postedAt: new Date(),
    pay: null,
  };

  it("skips postings 30 or more days old", () => {
    expect(normalizePosting({ ...recent, postedAt: new Date(Date.now() - 31 * 86_400_000) })).toEqual({ skip: "too_old" });
    expect("job" in normalizePosting({ ...recent, postedAt: new Date(Date.now() - 29 * 86_400_000) })).toBe(true);
  });

  it.each([
    ["Posted Today", 0],
    ["Posted Yesterday", 1],
    ["Posted 12 Days Ago", 12],
    ["Posted 30+ Days Ago", null],
    [undefined, null],
  ])("reads Workday's %s as %s days", (text, days) => {
    expect(workdayAgeDays(text)).toBe(days);
  });
});

describe("workdayIndiaFacet", () => {
  it("prefers a country-level India value, however deeply it is nested", () => {
    const facets = [
      { facetParameter: "jobFamilyGroup", values: [{ descriptor: "Engineering", id: "e1" }] },
      {
        facetParameter: "locationMainGroup",
        values: [
          { facetParameter: "locationHierarchy1", id: "", values: [{ descriptor: "India", id: "in1" }, { descriptor: "Canada", id: "ca1" }] },
          { facetParameter: "locations", id: "", values: [{ descriptor: "India, Pune", id: "p1" }] },
        ],
      },
    ];
    expect(workdayIndiaFacet(facets)).toEqual({ locationHierarchy1: ["in1"] });
  });

  it("falls back to every Indian location when there is no country facet", () => {
    const facets = [
      {
        facetParameter: "locations",
        values: [
          { descriptor: "Bangalore - Bagmane Tridib", id: "b1" },
          { descriptor: "IND - Hyderabad", id: "h1" },
          { descriptor: "Chicago", id: "c1" },
        ],
      },
    ];
    expect(workdayIndiaFacet(facets)).toEqual({ locations: ["b1", "h1"] });
    expect(workdayIndiaFacet([{ facetParameter: "locations", values: [{ descriptor: "London", id: "l1" }] }])).toBeNull();
  });
});

describe("MNC titles", () => {
  it.each([
    ["Custom Software Engineer", "ENGINEERING"],
    ["Firmware Engineer - Embedded", "ENGINEERING"],
    ["Software Engineer - Manufacturing Systems", "ENGINEERING"],
    ["Senior Data Engineer", "DATA"],
  ])("keeps %s", (title, expected) => {
    expect(classifyDiscipline(title)).toBe(expected);
  });

  it.each(["Mechanical Design Engineer", "Plant Maintenance Engineer", "Electrical Engineer - Power Systems", "Process Engineer II", "Field Service Engineer"])(
    "excludes %s",
    (title) => {
      expect(classifyDiscipline(title)).toBeNull();
    },
  );
});

describe("mergeLocations", () => {
  it("unions cities and keeps India only as a fallback", () => {
    expect(mergeLocations("Pune", "Bengaluru · Pune")).toBe("Pune · Bengaluru");
    expect(mergeLocations("India", "Hyderabad")).toBe("Hyderabad");
    expect(mergeLocations("India", "India")).toBe("India");
  });
});

describe("company feed tokens", () => {
  const company = { name: "NVIDIA", website: "https://www.nvidia.com", featured: "" };

  it("accepts each source's token format, including several career sites", () => {
    const ok = (atsSource: string, atsToken: string) => companyInputSchema.safeParse({ ...company, atsSource, atsToken }).success;
    expect(ok("WORKDAY", "nvidia.wd5.myworkdayjobs.com|nvidia|NVIDIAExternalCareerSite")).toBe(true);
    expect(ok("WORKDAY", "hpe.wd5.myworkdayjobs.com|hpe|Jobsathpe  hpe.wd5.myworkdayjobs.com|hpe|ACJobSite")).toBe(true);
    expect(ok("ORACLE", "jpmc.fa.oraclecloud.com|CX_1001|300000000289360")).toBe(true);
    expect(ok("GREENHOUSE", "stripe")).toBe(true);
    expect(ok("WORKDAY", "nvidia")).toBe(false);
    expect(ok("GREENHOUSE", "")).toBe(false);
    expect(ok("GREENHOUSE", "https://evil.example")).toBe(false);
  });
});
