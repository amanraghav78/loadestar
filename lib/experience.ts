import type { Prisma } from "@/lib/generated/prisma/client";
import type { Level } from "@/lib/generated/prisma/enums";

/**
 * The experience filter on /jobs (`?exp=3-5`).
 *
 * A bucket is the years a candidate has, from `lo` up to but not including
 * `hi`, so someone with exactly 3 years is in "3–5", not also in "1–3".
 *
 * A job asks for a range: "3-5 years" (min 3, max 5), or "3+ years" (min 3,
 * max null). An open "3+" is read as 3 up to 5 (OPEN_SPAN years), because the
 * alternative, "3 or anything above", would put every "1+ years" role in the
 * 8+ bucket too. A job matches a bucket when the two ranges overlap.
 *
 * Jobs whose posting names no years (most of them) fall back to their level,
 * so they neither vanish from the filter nor show up in every bucket: an
 * intern role is a fresher role, a senior one asks for 5+ years, and so on.
 */
export const EXPERIENCE_BUCKETS = {
  "0-1": { label: "Fresher", lo: 0, hi: 1 },
  "1-3": { label: "1–3 yrs", lo: 1, hi: 3 },
  "3-5": { label: "3–5 yrs", lo: 3, hi: 5 },
  "5-8": { label: "5–8 yrs", lo: 5, hi: 8 },
  "8-plus": { label: "8+ yrs", lo: 8, hi: null },
} as const satisfies Record<string, { label: string; lo: number; hi: number | null }>;

export type ExperienceBucket = keyof typeof EXPERIENCE_BUCKETS;

export const EXPERIENCE_BUCKET_KEYS = Object.keys(EXPERIENCE_BUCKETS) as [ExperienceBucket, ...ExperienceBucket[]];

/** How many years past its minimum an open-ended ask ("3+ years") is read to cover. */
export const OPEN_SPAN = 2;

export type YearsRange = { min: number; max: number | null };

/** What a role of each level usually asks for, used only when its posting doesn't say. */
export const LEVEL_EXPERIENCE: Record<Level, YearsRange> = {
  INTERN: { min: 0, max: 1 },
  JUNIOR: { min: 0, max: 2 },
  MID: { min: 2, max: 5 },
  SENIOR: { min: 5, max: null },
  STAFF: { min: 8, max: null },
  PRINCIPAL: { min: 10, max: null },
  MANAGER: { min: 8, max: null },
  DIRECTOR: { min: 10, max: null },
};

/** Where an ask ends, exclusive: "3-5" ends at 5, "3+" at 5, "3" (min = max) at 4. */
function askEnd({ min, max }: YearsRange) {
  return max === null ? min + OPEN_SPAN : Math.max(max, min + 1);
}

/** Whether a job asking for `range` belongs in `bucket`. The reference for `experienceWhere`. */
export function rangeInBucket(range: YearsRange, bucket: ExperienceBucket) {
  const { lo, hi } = EXPERIENCE_BUCKETS[bucket];
  return (hi === null || range.min < hi) && askEnd(range) > lo;
}

/** The levels whose usual ask falls in `bucket`, for jobs that name no years. */
export function levelsInBucket(bucket: ExperienceBucket) {
  return (Object.keys(LEVEL_EXPERIENCE) as Level[]).filter((level) => rangeInBucket(LEVEL_EXPERIENCE[level], bucket));
}

/**
 * `rangeInBucket` as a query. The ask's end is only known in SQL through its
 * cases, so "ends after lo" is spelled out: min ≥ lo; or max > lo; or an open
 * ask whose OPEN_SPAN reaches past lo.
 */
export function experienceWhere(bucket: ExperienceBucket): Prisma.JobWhereInput {
  const { lo, hi } = EXPERIENCE_BUCKETS[bucket];
  const known: Prisma.JobWhereInput[] = [{ experienceMin: hi === null ? { not: null } : { lt: hi } }];
  if (lo > 0) {
    known.push({
      OR: [
        { experienceMin: { gte: lo } },
        { experienceMax: { gt: lo } },
        { experienceMax: null, experienceMin: { gt: lo - OPEN_SPAN } },
      ],
    });
  }
  return {
    OR: [{ AND: known }, { experienceMin: null, level: { in: levelsInBucket(bucket) } }],
  };
}

/** "3–5 yrs", "5+ yrs", "2 yrs"; null when the posting didn't say. */
export function formatExperience(min: number | null, max: number | null) {
  if (min === null) return null;
  const unit = (n: number) => (n === 1 ? "yr" : "yrs");
  if (max === null) return `${min}+ yrs`;
  if (max === min) return `${min} ${unit(min)}`;
  return `${min}–${max} ${unit(max)}`;
}
