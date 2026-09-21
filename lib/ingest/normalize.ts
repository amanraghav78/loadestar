import { createHash } from "node:crypto";
import type { Discipline, Level, RemotePolicy } from "@/lib/generated/prisma/enums";
import { classifyDiscipline, classifyLevel, extractTags, indiaLocation } from "@/lib/ingest/classify";
import { parseInrSalary } from "@/lib/ingest/salary";
import type { RawPosting } from "@/lib/ingest/sources";

export type NormalizedJob = {
  externalId: string;
  title: string;
  description: string;
  discipline: Discipline;
  level: Level;
  tags: string[];
  location: string;
  remote: RemotePolicy;
  remoteRegion: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  applyUrl: string;
  postedAt: Date;
  contentHash: string;
};

export type SkipReason = "not_india" | "not_in_scope" | "bad_url";

/**
 * Turns a raw posting into a listing, or explains why it was skipped.
 * Only India-based product/design/engineering/data roles pass. Salary is kept
 * only when stated in INR, so a US band on a multi-country posting never shows
 * up on an Indian role.
 */
export function normalizePosting(p: RawPosting): { job: NormalizedJob } | { skip: SkipReason } {
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
    description: p.description || "See the full description on the company's careers page.",
    discipline,
    level: classifyLevel(p.title),
    tags: extractTags(p.title, p.description),
    location,
    remote,
    remoteRegion: remote === "REMOTE" ? "India" : null,
    salaryMin: band?.min ?? null,
    salaryMax: band?.max ?? null,
    applyUrl,
    postedAt: p.postedAt,
  };

  return { job: { ...job, contentHash: hashJob(job) } };
}

/** Fingerprint of everything we display, so the sync only rewrites changed rows. */
function hashJob(job: Omit<NormalizedJob, "contentHash"> & { contentHash?: string }) {
  // postedAt and the previous hash are excluded: neither changes what we display.
  const rest: Partial<NormalizedJob> = { ...job };
  delete rest.postedAt;
  delete rest.contentHash;
  return createHash("sha1").update(JSON.stringify(rest)).digest("hex");
}

/**
 * Some boards publish the same role once per city. Keep one listing per
 * title+band and merge the cities into it.
 */
export function dedupe(jobs: NormalizedJob[]) {
  const byKey = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const key = `${job.title.toLowerCase()}|${job.salaryMin ?? ""}|${job.salaryMax ?? ""}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, job);
      continue;
    }
    const cities = new Set([...existing.location.split(" · "), ...job.location.split(" · ")].filter((c) => c !== "India"));
    if (cities.size > 0) existing.location = [...cities].slice(0, 3).join(" · ");
    if (job.postedAt < existing.postedAt) existing.postedAt = job.postedAt;
  }
  return [...byKey.values()].map((job) => ({ ...job, contentHash: hashJob(job) }));
}
