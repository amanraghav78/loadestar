/**
 * Search-box suggestions: building the vocabulary from active listings and
 * matching a partly typed term against it. Pure, so it runs in the route
 * handler (app/api/suggest) and in unit tests alike; the data comes from
 * `getSuggestVocabulary` in lib/queries.ts.
 *
 * The vocabulary is small (a few thousand titles, a couple of hundred
 * companies and skills, two dozen cities), so matching is a linear scan over
 * pre-normalised keys: well under a millisecond, no index needed.
 */
import { INDIA_CITIES } from "@/lib/ingest/classify";

export type SuggestField = "q" | "location";

export type SuggestKind = "title" | "company" | "skill" | "city" | "remote";

/** One thing a term can complete to. `key` is `label` normalised; `alt` are extra names (aliases) it answers to. */
export type SuggestEntry = {
  kind: SuggestKind;
  label: string;
  key: string;
  /** Active jobs behind it: the ranking weight. */
  count: number;
  /** Company page slug. */
  slug?: string;
  alt?: string[];
};

export type SuggestVocabulary = { q: SuggestEntry[]; location: SuggestEntry[] };

/**
 * What the route sends back, kept terse: the kind, the label, the matched span
 * of the label to highlight, the alias that matched (so "Bangalore" can say why
 * it offered Bengaluru), and a company's slug.
 */
export type Suggestion = {
  k: SuggestKind;
  v: string;
  m?: [number, number];
  a?: string;
  s?: string;
};

export const SUGGEST_LIMIT = 8;

// ------------------------------------------------------------ normalising

/** Lowercase, accents off, punctuation to spaces (keeping the + # . of "C++", "C#", "Node.js"). */
export function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/(^|\s)\.+|\.+(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Short forms feeds use in titles, spelled out so "Sr. SDE" and "Senior SDE" are one suggestion. */
const TITLE_WORDS: Record<string, string> = {
  sr: "senior",
  snr: "senior",
  jr: "junior",
  jnr: "junior",
  mgr: "manager",
  engg: "engineer",
  asst: "assistant",
  assoc: "associate",
};

/** Trailing bits that describe where, not what: "Backend Engineer - Bengaluru", "SRE (Remote)". */
const PLACE_WORDS = new RegExp(
  `\\b(${[
    ...INDIA_CITIES,
    "Bangalore",
    "Gurgaon",
    "Bombay",
    "New Delhi",
    "NCR",
    "India",
    "Remote",
    "Hybrid",
    "Onsite",
    "On-site",
    "WFH",
  ]
    .map((w) => w.toLowerCase().replace(/[-\s]/g, "[-\\s]?"))
    .join("|")})\\b`,
  "i",
);

/**
 * The title as we suggest it: bracketed notes dropped ("(Contract)",
 * "[Remote]") and a trailing place ("- Pune", ", Remote - India") cut off.
 * Team names after a comma stay: "Product Designer, Payouts" is a real role.
 */
export function cleanTitle(title: string) {
  const t = title
    .replace(/\s*[([{][^)\]}]*[)\]}]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // [part, separator, part, separator, part…]: cut before the first later part that names a place.
  const pieces = t.split(/(\s+[-–—|/]\s+|\s*,\s*)/);
  const at = pieces.findIndex((p, i) => i > 1 && i % 2 === 0 && PLACE_WORDS.test(p));
  const kept = at > 0 ? pieces.slice(0, at - 1).join("") : t;
  return kept.replace(/[\s,\-–—|/:]+$/, "");
}

/** The key titles merge on: normalised, abbreviations spelled out. */
export function titleKey(title: string) {
  return normalize(cleanTitle(title))
    .split(" ")
    .map((w) => TITLE_WORDS[w.replace(/\.$/, "")] ?? w.replace(/\.$/, ""))
    .join(" ");
}

// ------------------------------------------------------------ places

/**
 * Other names people type for a city. "NCR" answers with each of its cities,
 * since listings name the city, not the region.
 */
export const CITY_ALIASES: Record<string, string[]> = {
  Bengaluru: ["Bangalore", "Bengaluru", "BLR", "Bangaluru"],
  Hyderabad: ["Secunderabad", "Hyd", "Cyberabad"],
  Pune: ["Poona"],
  Gurugram: ["Gurgaon", "GGN", "NCR", "Delhi NCR"],
  Noida: ["Greater Noida", "NCR", "Delhi NCR"],
  Delhi: ["New Delhi", "NCR", "Delhi NCR"],
  Mumbai: ["Bombay", "Navi Mumbai", "Thane"],
  Chennai: ["Madras"],
  Kolkata: ["Calcutta"],
  Kochi: ["Cochin", "Ernakulam"],
  Thiruvananthapuram: ["Trivandrum", "TVM"],
  Vadodara: ["Baroda"],
  Mysuru: ["Mysore"],
  Visakhapatnam: ["Vizag"],
  Bhubaneswar: ["Bhubaneshwar"],
};

export const REMOTE_ALIASES = ["WFH", "Work from home", "Anywhere", "Remote India"];

// ------------------------------------------------------------ building

type JobRow = { title: string; tags: string[]; location: string; remote: string };
type CompanyRow = { name: string; slug: string; openRoles: number };

/**
 * Turns active listings into the vocabulary. Titles that normalise alike are
 * merged, shown by their most common spelling and weighted by all their jobs.
 * Cities count the way the home page's city list does (`location` contains
 * the name), so a suggestion never offers a city with nothing in it.
 */
export function buildVocabulary(jobs: JobRow[], companies: CompanyRow[]): SuggestVocabulary {
  const titles = new Map<string, { count: number; spellings: Map<string, number> }>();
  const skills = new Map<string, { count: number; spellings: Map<string, number> }>();
  const bump = (map: Map<string, { count: number; spellings: Map<string, number> }>, key: string, spelling: string) => {
    if (!key) return;
    const e = map.get(key) ?? { count: 0, spellings: new Map() };
    e.count++;
    e.spellings.set(spelling, (e.spellings.get(spelling) ?? 0) + 1);
    map.set(key, e);
  };

  const cityCounts = new Map<string, number>();
  let remote = 0;
  for (const job of jobs) {
    bump(titles, titleKey(job.title), cleanTitle(job.title));
    for (const tag of new Set(job.tags)) bump(skills, normalize(tag), tag.trim());
    for (const city of INDIA_CITIES)
      if (job.location.includes(city)) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    if (job.remote === "REMOTE") remote++;
  }

  const topSpelling = (spellings: Map<string, number>) =>
    [...spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

  const q: SuggestEntry[] = [];
  const taken = new Set<string>();
  for (const c of companies) {
    const key = normalize(c.name);
    if (!key || c.openRoles < 1 || taken.has(key)) continue;
    taken.add(key);
    q.push({ kind: "company", label: c.name, key, count: c.openRoles, slug: c.slug });
  }
  for (const [key, e] of titles) {
    if (taken.has(key)) continue;
    taken.add(key);
    q.push({ kind: "title", label: topSpelling(e.spellings), key, count: e.count });
  }
  for (const [key, e] of skills) {
    if (taken.has(key) || key.length < 1) continue;
    taken.add(key);
    q.push({ kind: "skill", label: topSpelling(e.spellings), key, count: e.count });
  }

  const location: SuggestEntry[] = [];
  for (const [city, count] of cityCounts) {
    const alt = (CITY_ALIASES[city] ?? []).map(normalize).filter((a) => a !== normalize(city));
    location.push({ kind: "city", label: city, key: normalize(city), count, ...(alt.length ? { alt } : {}) });
  }
  if (remote > 0)
    location.push({
      kind: "remote",
      label: "Remote",
      key: "remote",
      count: remote,
      alt: REMOTE_ALIASES.map(normalize),
    });
  location.sort((a, b) => b.count - a.count);

  return { q, location };
}

// ------------------------------------------------------------ matching

/**
 * How well a term matches a key: 0 the key starts with it, 1 it starts a later
 * word, 2 every word of the term starts some word of the key ("backend senior"),
 * null no match. Prefix beats word-start beats scattered.
 */
export function matchTier(key: string, term: string): 0 | 1 | 2 | null {
  if (!term) return null;
  if (key.startsWith(term)) return 0;
  if (key.includes(" " + term)) return 1;
  const words = term.split(" ");
  if (words.length > 1) {
    const keyWords = key.split(" ");
    if (words.every((w) => keyWords.some((k) => k.startsWith(w)))) return 2;
  }
  return null;
}

/**
 * The span of `label` to highlight for `term`: where the typed text starts the
 * label or one of its words. Case-insensitive, on the label as displayed.
 */
export function highlightRange(label: string, term: string): [number, number] | undefined {
  const t = term.trim().toLowerCase();
  if (!t) return undefined;
  const l = label.toLowerCase();
  if (l.startsWith(t)) return [0, t.length];
  const re = new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  const hit = re.exec(l);
  if (hit) {
    const start = hit.index + hit[1].length;
    return [start, start + t.length];
  }
  // First word of a multi-word term, when the words are scattered.
  const firstWord = t.split(/\s+/)[0];
  return firstWord !== t ? highlightRange(label, firstWord) : undefined;
}

/** At most this many of a kind, so a common word doesn't push the others out. */
const KIND_CAP: Partial<Record<SuggestKind, number>> = { company: 3, skill: 3 };
/** Ties go to the more specific kind: a company, then a title, then a skill. */
const KIND_ORDER: Record<SuggestKind, number> = { company: 0, city: 0, remote: 1, title: 1, skill: 2 };

/**
 * The best completions of `term` for a field, best first. An exact match
 * leads; then prefix matches, then word-start matches, each by how many jobs
 * they cover. An empty location term lists the busiest places, which is what
 * the city box shows on focus; an empty keyword term suggests nothing (the
 * client shows recent searches there).
 */
export function suggest(
  vocab: SuggestVocabulary,
  field: SuggestField,
  rawTerm: string,
  limit = SUGGEST_LIMIT,
): Suggestion[] {
  const entries = vocab[field];
  const term = field === "q" ? titleKey(rawTerm) : normalize(rawTerm);

  if (!term) {
    return field === "location" ? entries.slice(0, limit).map((e) => ({ k: e.kind, v: e.label })) : [];
  }

  type Hit = { e: SuggestEntry; tier: number; alias?: string };
  const hits: Hit[] = [];
  for (const e of entries) {
    // -1 is an exact match, ahead of every prefix.
    let tier: number | null = matchTier(e.key, term);
    let alias: string | undefined;
    if (e.key === term) tier = -1;
    for (const a of e.alt ?? []) {
      const at = a === term ? -1 : matchTier(a, term);
      if (at !== null && (tier === null || at < tier)) {
        tier = at;
        alias = a;
      }
    }
    if (tier !== null) hits.push({ e, tier, alias });
  }

  hits.sort(
    (a, b) =>
      a.tier - b.tier ||
      b.e.count - a.e.count ||
      KIND_ORDER[a.e.kind] - KIND_ORDER[b.e.kind] ||
      a.e.label.length - b.e.label.length ||
      a.e.label.localeCompare(b.e.label),
  );

  const perKind = new Map<SuggestKind, number>();
  const out: Suggestion[] = [];
  for (const { e, alias } of hits) {
    const n = perKind.get(e.kind) ?? 0;
    if (n >= (KIND_CAP[e.kind] ?? Infinity)) continue;
    perKind.set(e.kind, n + 1);
    const s: Suggestion = { k: e.kind, v: e.label };
    const m = alias ? undefined : highlightRange(e.label, rawTerm);
    if (m) s.m = m;
    if (alias) s.a = aliasLabel(e, alias);
    if (e.slug) s.s = e.slug;
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** The alias as people write it ("Bangalore", not "bangalore"). */
function aliasLabel(e: SuggestEntry, alias: string) {
  const pool = e.kind === "remote" ? REMOTE_ALIASES : (CITY_ALIASES[e.label] ?? []);
  return pool.find((p) => normalize(p) === alias) ?? alias;
}
