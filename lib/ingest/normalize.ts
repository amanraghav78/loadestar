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
  /** Years of experience asked for (parseExperience); null when the posting doesn't say. */
  experienceMin: number | null;
  experienceMax: number | null;
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
  const experience = parseExperience(p.title, p.description);

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
    experienceMin: experience?.min ?? null,
    experienceMax: experience?.max ?? null,
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
  // Experience is read from the title and description, which are hashed already;
  // leaving it out keeps the hashes of rows stored before it existed, so adding
  // it didn't rewrite every row (scripts/backfill-experience.ts fills those).
  const rest: Partial<NormalizedJob> = { ...job };
  delete rest.postedAt;
  delete rest.contentHash;
  delete rest.role;
  delete rest.experienceMin;
  delete rest.experienceMax;
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
      // What parseExperience read, as normalizePosting stored it.
      job.experienceMin === null ? "" : `${job.experienceMin}-${job.experienceMax ?? "+"}`,
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

// ------------------------------------------------------------------ experience

/**
 * Years of experience a role asks for: "3-5 years" is { min: 3, max: 5 },
 * "3+ years" is { min: 3, max: null }, a fresher role is { min: 0, max: 1 }.
 */
export type ExperienceRange = { min: number; max: number | null };

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
};
const NUM = String.raw`(?:\d{1,2}(?:\.\d)?(?!\d)|${Object.keys(WORD_NUMBERS).join("|")})`;

/** An amount of years, with what qualifies it: "at least two years", "3 – 5 yrs", "10+ yrs", "5 or more years". */
const YEARS = new RegExp(
  String.raw`(?<lead>\b(?:minimum(?:\s+of)?|min\.?|at\s*least|over|more\s+than|up\s*to|between)\s+)?` +
    String.raw`\b(?<a>${NUM})(?:\s*(?<sep>-|–|—|to|and)\s*(?<b>${NUM}))?` +
    String.raw`(?<plus>\s*\+|\s+or\s+(?:more|above))?\s*-?\s*(?:years?|yrs?)\b\.?['’]?(?<plus2>\s*\+)?`,
  "gi",
);

/** Says the figure is about the candidate's experience. */
const EXPERIENCE = /\b(?:experience[ds]?|exp)\b/i;
/** Right after the figure, says it is experience even without the word: "4+ years building …". */
const EXPERIENCE_LIKE =
  /^\s*(?:of\s+)?(?:(?:relevant|professional|industry|hands-on|proven|prior|post-qualification|full-time|work|working)\b|(?:as|in)\s+(?:a|an)\s|(?:building|developing|designing|leading|managing|shipping)\b)/i;
/** Between the figure and "experience", these make it about something else: "2 years of warranty". */
const NOT_EXPERIENCE =
  /\b(?:ago|old|warranty|guarantee|bond|agreement|contract|commitment|lock-?in|tenure|degree|diploma|course|program(?:me)?|bachelor'?s?|college|university|graduation|study|studies|schooling|business|operations|history|anniversary|visa|vesting|cliff|stay)\b/i;
/** Just before the figure: "founded 10 years", "age 21-28 years". */
const NOT_EXPERIENCE_BEFORE =
  /\b(?:founded|established|incorporated|since|age(?:\s+(?:limit|group|range|between))?|aged|anniversary|celebrating)\W*$/i;
/** A sentence about the employer rather than the candidate: "With over 20 years of experience, we …". */
const ABOUT_US = /\b(?:we|we've|we're|our|us|combined|collective)\b/i;
const ABOUT_YOU =
  /\b(?:you|your|you'll|candidates?|applicants?|looking\s+for|seeking|must|should|required|requirements?|ideal(?:ly)?|preferred|minimum|at\s+least|need)\b/i;
/** A label line such as "Experience:" or "## Required experience" with the figure on the next line. */
const EXPERIENCE_LABEL = /^[\W_]*(?:(?:total|work|relevant|required|years\s+of)\s+)?(?:experience|exp)\b[\W_]*$/i;

const FRESHER_TITLE = /\bfreshers?\b/i;
const FRESHER_TEXT = [
  /\bfreshers?\s+(?:are\s+|can\s+(?:also\s+)?|may\s+)?(?:welcome|encouraged|eligible|apply|preferred|only)\b/i,
  /\b(?:open\s+to|suitable\s+for|ideal\s+for|only|hiring)\s+freshers?\b/i,
  /\b(?:experience|exp)(?:\s+(?:level|required))?\s*[:\-–]\s*freshers?\b/i,
];
const FRESHER_REFUSED =
  /\b(?:no|not|non|nor)\b(?:\W+\w+){0,2}\W+freshers?\b|\bfreshers?\b(?:\W+\w+){0,2}\W+(?:not|don['’]?t)\b/i;

const FRESHER: ExperienceRange = { min: 0, max: 1 };

const toNumber = (s: string) => WORD_NUMBERS[s.toLowerCase()] ?? Number(s);

/** The range one match describes, or null when it isn't a plausible ask ("5-3 years", "0-25 years"). */
function readYears(m: RegExpMatchArray): ExperienceRange | null {
  const g = m.groups!;
  const lead = g.lead?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
  const a = toNumber(g.a!);
  let range: ExperienceRange;
  if (g.b) {
    if (g.sep === "and" && lead !== "between") return null;
    range = { min: Math.floor(a), max: Math.ceil(toNumber(g.b)) };
  } else if (lead === "up to" || lead === "upto") {
    range = { min: 0, max: Math.ceil(a) };
  } else {
    range = { min: Math.floor(a), max: null };
  }
  if (range.min > 30) return null;
  if (range.max !== null && (range.max < range.min || range.max > 40 || range.max - range.min > 15)) return null;
  if (range.max === range.min && range.min > 0) range.max = null;
  return range;
}

/** The sentence around a match: split on new lines, semicolons, bullets and full stops. */
function clauseAround(text: string, start: number, end: number) {
  const before = text.slice(0, start);
  const cut = Math.max(before.search(/[^\n;•]*$/), ...[...before.matchAll(/[.!?]\s/g)].map((x) => x.index + 2));
  const after = text.slice(end);
  const stop = after.search(/[\n;•]|[.!?](?:\s|$)/);
  return {
    head: text.slice(Math.max(cut, start - 120), start),
    tail: after.slice(0, stop === -1 ? 120 : Math.min(stop, 120)),
    /** The current line up to the match. */
    line: before.slice(before.lastIndexOf("\n") + 1),
    /** The nearest non-blank line above it. */
    previousLine:
      before
        .slice(0, before.lastIndexOf("\n") + 1)
        .trimEnd()
        .split("\n")
        .pop() ?? "",
  };
}

function isExperienceAsk(text: string, m: RegExpMatchArray) {
  const { head, tail, line, previousLine } = clauseAround(text, m.index!, m.index! + m[0].length);
  // Only what sits between the figure and the word "experience" can change its meaning.
  const upToKeyword = tail.slice(0, tail.search(EXPERIENCE) === -1 ? 40 : tail.search(EXPERIENCE));
  if (NOT_EXPERIENCE.test(upToKeyword) || NOT_EXPERIENCE_BEFORE.test(head)) return false;
  const clause = `${head}${m[0]}${tail}`;
  if (ABOUT_US.test(clause) && !ABOUT_YOU.test(clause)) return false;
  if (EXPERIENCE.test(head) || EXPERIENCE.test(tail) || EXPERIENCE_LIKE.test(tail)) return true;
  // "Experience:" on a line of its own, and the figure opening the next.
  return EXPERIENCE_LABEL.test(previousLine) && /^[\s\-*–•]*$/.test(line);
}

/**
 * The experience a posting asks for, or null when it doesn't say.
 *
 * The title is trusted with any figure in years ("Backend Engineer (2-4
 * yrs)"). In the description a figure only counts when its sentence is about
 * experience ("3+ years of experience", "Experience: 5 to 8 yrs", "at least
 * two years building …"), so "founded 10 years ago", "a 4-year degree" and
 * "2 years of warranty" don't. The first such figure wins. A role that asks
 * for no figure but welcomes freshers is { min: 0, max: 1 }.
 */
export function parseExperience(title: string, description: string): ExperienceRange | null {
  for (const m of title.matchAll(YEARS)) {
    const tail = title.slice(m.index + m[0].length);
    if (NOT_EXPERIENCE.test(tail.slice(0, 30))) continue;
    const range = readYears(m);
    if (range) return range;
  }
  for (const m of description.matchAll(YEARS)) {
    if (!isExperienceAsk(description, m)) continue;
    const range = readYears(m);
    if (range) return range;
  }
  if (FRESHER_TITLE.test(title) && !FRESHER_REFUSED.test(title)) return FRESHER;
  if (!FRESHER_REFUSED.test(description) && FRESHER_TEXT.some((re) => re.test(description))) return FRESHER;
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
