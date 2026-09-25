import { createHash } from "node:crypto";
import type { Discipline, EmploymentType, Level, RemotePolicy } from "@/lib/generated/prisma/enums";
import {
  classifyDiscipline,
  classifyEmploymentType,
  classifyLevel,
  extractTags,
  indiaLocation,
  matchIndiaCity,
} from "@/lib/ingest/classify";
import { listingCutoff } from "@/lib/listing-age";
import { parseInrSalary } from "@/lib/ingest/salary";
import type { RawPosting } from "@/lib/ingest/sources";

export type NormalizedJob = {
  externalId: string;
  title: string;
  description: string;
  discipline: Discipline;
  level: Level;
  employmentType: EmploymentType;
  tags: string[];
  location: string;
  remote: RemotePolicy;
  remoteRegion: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  applyUrl: string;
  postedAt: Date;
  contentHash: string;
  /** What the board says about the role beyond its title. Only `dedupe` reads it; never shown or hashed. */
  role: RoleSignals;
};

export type RoleSignals = {
  requisitionId: string | null;
  /** Lowercased, like `classification`, so "Engineering" and "engineering " compare equal. */
  department: string | null;
  classification: string | null;
};

/** Shown when a board gives no description, or none yet (search-style sources fetch it later). */
const NO_DESCRIPTION = "See the full description on the company's careers page.";

const signal = (s?: string | null) => s?.replace(/\s+/g, " ").trim().toLowerCase() || null;

export type SkipReason = "too_old" | "not_india" | "not_in_scope" | "bad_url";

/**
 * Turns a raw posting into a listing, or explains why it was skipped.
 * Only India-based product/design/engineering/data roles posted within the
 * last 30 days pass. Salary is kept only when stated in INR, so a US band on a
 * multi-country posting never shows up on an Indian role.
 */
export function normalizePosting(
  p: RawPosting,
  since = listingCutoff(),
): { job: NormalizedJob } | { skip: SkipReason } {
  if (p.postedAt < since) return { skip: "too_old" };

  const india = indiaLocation(p.locations, p.workplace);
  if (!india) return { skip: "not_india" };

  const discipline = classifyDiscipline(p.title, p.department);
  if (!discipline) return { skip: "not_in_scope" };

  let applyUrl: string;
  try {
    const u = new URL(p.applyUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return { skip: "bad_url" };
    applyUrl = u.toString();
  } catch {
    return { skip: "bad_url" };
  }

  const remote: RemotePolicy =
    india.remote || p.workplace === "REMOTE" ? "REMOTE" : p.workplace === "HYBRID" ? "HYBRID" : "ONSITE";
  const location = india.cities.length > 0 ? india.cities.slice(0, 3).join(" · ") : "India";

  let band: { min: number; max: number } | null = null;
  if (p.pay && p.pay.currency.toUpperCase() === "INR" && /year|annual|1 YEAR/i.test(p.pay.interval)) {
    const min = Math.round(Math.min(p.pay.min, p.pay.max));
    const max = Math.round(Math.max(p.pay.min, p.pay.max));
    if (min >= 100_000 && max <= 200_000_000) band = { min, max };
  }
  band ??= parseInrSalary(p.description);

  const job: Omit<NormalizedJob, "contentHash"> = {
    externalId: p.externalId,
    title: p.title.replace(/\s+/g, " ").slice(0, 160),
    description: p.description || NO_DESCRIPTION,
    discipline,
    level: classifyLevel(p.title),
    employmentType: classifyEmploymentType(p.title),
    tags: extractTags(p.title, p.description),
    location,
    remote,
    remoteRegion: remote === "REMOTE" ? "India" : null,
    salaryMin: band?.min ?? null,
    salaryMax: band?.max ?? null,
    applyUrl,
    postedAt: p.postedAt,
    role: {
      requisitionId: p.requisitionId?.trim() || null,
      department: signal(p.department),
      classification: signal(p.classification),
    },
  };

  return { job: { ...job, contentHash: hashJob(job) } };
}

/** Fingerprint of everything we display, so the sync only rewrites changed rows. */
function hashJob(job: Omit<NormalizedJob, "contentHash"> & { contentHash?: string }) {
  // postedAt, the role signals and the previous hash are excluded: none changes what we display.
  const rest: Partial<NormalizedJob> = { ...job };
  delete rest.postedAt;
  delete rest.contentHash;
  delete rest.role;
  return createHash("sha1").update(JSON.stringify(rest)).digest("hex");
}

/**
 * Some boards publish the same role once per city, or once per career site.
 * Those postings become one listing with their cities merged. A shared title
 * is not enough, though: "Software Engineer" for new grads and for five years'
 * experience are two roles, and merging them would hide one. Postings are the
 * same role when either
 *  - the board files them under one requisition and their titles match, or
 *  - everything we know about the role matches (title, level, employment type,
 *    workplace, salary band, department, the board's own classification and
 *    the years of experience asked for) and both have a description, the same
 *    text but for city names.
 * Anything else stays separate: a visible duplicate costs less than a hidden job.
 *
 * `listed` maps the externalIds already stored for this source to whether they
 * are active. A merged listing keeps the id it was stored under (and with it
 * the slug, saves and applications); a new one takes the smallest id. Input
 * order never changes the result.
 */
export function dedupe(jobs: NormalizedJob[], listed: ReadonlyMap<string, boolean> = new Map()) {
  const parent = jobs.map((_, i) => i);
  const root = (i: number) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]!]!;
    return i;
  };
  const join = (a: number, b: number) => {
    parent[root(a)] = root(b);
  };
  const facts = jobs.map(roleFacts);

  for (const group of groupsOf(
    jobs.length,
    (i) => jobs[i]!.role.requisitionId && `${jobs[i]!.role.requisitionId}|${facts[i]!.title}`,
  )) {
    for (const i of group) join(i, group[0]!);
  }
  for (const group of groupsOf(jobs.length, (i) => facts[i]!.described && facts[i]!.key)) {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        const [x, y] = [group[a]!, group[b]!];
        if (root(x) !== root(y) && overlap(facts[x]!.words(), facts[y]!.words()) >= SAME_TEXT) join(x, y);
      }
    }
  }

  const merged = new Map<number, NormalizedJob[]>();
  jobs.forEach((job, i) => {
    const group = merged.get(root(i));
    if (group) group.push(job);
    else merged.set(root(i), [job]);
  });
  // Active listing first, then an expired one we'd bring back, then a new posting.
  const rank = (job: NormalizedJob) => {
    const active = listed.get(job.externalId);
    return active === undefined ? 2 : active ? 0 : 1;
  };
  return [...merged.values()].map((group) => {
    const [keep, ...rest] = group.sort(
      (a, b) => rank(a) - rank(b) || (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0),
    );
    let { location, postedAt } = keep!;
    for (const job of rest) {
      location = mergeLocations(location, job.location);
      if (job.postedAt < postedAt) postedAt = job.postedAt;
    }
    return rehash({ ...keep!, location, postedAt });
  });
}

/** Share of distinct words two descriptions must have in common to count as the same text. */
const SAME_TEXT = 0.9;

/** Indices whose key is set, grouped by key; only groups of two or more. */
function groupsOf(n: number, key: (i: number) => string | false | null) {
  const groups = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const k = key(i);
    if (!k) continue;
    const group = groups.get(k);
    if (group) group.push(i);
    else groups.set(k, [i]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

function roleFacts(job: NormalizedJob) {
  const title = titleKey(job.title);
  let words: Set<string> | undefined;
  return {
    title,
    described: job.description !== NO_DESCRIPTION,
    key: [
      title,
      job.level,
      job.employmentType,
      job.remote,
      job.salaryMin ?? "",
      job.salaryMax ?? "",
      job.role.department ?? "",
      job.role.classification ?? "",
      yearsOfExperience(job.title, job.description) ?? "",
    ].join("|"),
    // Only built for postings that share every other fact, which is few of them.
    words: () => (words ??= wordSet(job.description)),
  };
}

const TITLE_WORDS: Record<string, string> = { sr: "senior", snr: "senior", jr: "junior", ii: "2", iii: "3", iv: "4" };

/**
 * A title with its trivial variation removed, for comparison only:
 * "Sr. Software Engineer II - Bangalore" → "senior software engineer 2".
 */
export function titleKey(title: string) {
  return title
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w && w !== "and" && w !== "india" && !matchIndiaCity(w))
    .map((w) => TITLE_WORDS[w] ?? (w === "i" ? "1" : w))
    .join(" ");
}

const YEARS = /(\d{1,2})\s*(?:(?:-|–|—|to)\s*(\d{1,2})\s*)?\+?\s*(?:years?|yrs?)\b/gi;

/**
 * The experience a posting asks for, as "3-5" or "5+": from the title when it
 * says, else from the first figure in the description that sits next to the
 * word "experience" (so "founded 10 years ago" doesn't count).
 */
export function yearsOfExperience(title: string, description: string): string | null {
  const read = (m: RegExpMatchArray) => (m[2] ? `${m[1]}-${m[2]}` : `${m[1]}+`);
  const inTitle = [...title.matchAll(YEARS)][0];
  if (inTitle) return read(inTitle);
  for (const m of description.matchAll(YEARS)) {
    const around = description.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
    if (/experience|\bexp\b/i.test(around)) return read(m);
  }
  return null;
}

/** Distinct words of a description, leaving out city names so per-city copies of one text compare equal. */
function wordSet(text: string) {
  const words = new Set(text.toLowerCase().match(/[a-z0-9+#]{2,}/g));
  for (const w of words) if (matchIndiaCity(w)) words.delete(w);
  return words;
}

/** Shared distinct words over all distinct words (Jaccard): 1 for the same text, 0 for nothing in common. */
function overlap(a: Set<string>, b: Set<string>) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared || 1);
}

/** "Pune" + "Bengaluru · Pune" → "Pune · Bengaluru" (at most 3 cities; "India" only when none is known). */
export function mergeLocations(a: string, b: string) {
  const cities = new Set([...a.split(" · "), ...b.split(" · ")].filter((c) => c && c !== "India"));
  return cities.size > 0 ? [...cities].slice(0, 3).join(" · ") : "India";
}

/** Re-fingerprints a listing after a field was changed outside normalizePosting. */
export function rehash(job: NormalizedJob): NormalizedJob {
  return { ...job, contentHash: hashJob(job) };
}
