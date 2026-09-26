import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { JobSource } from "@/lib/generated/prisma/enums";
import { buildSearchText, slugify } from "@/lib/format";
import { BOOTSTRAP_COMPANIES } from "@/lib/ingest/companies";
import { dedupe, mergeLocations, normalizePosting, rehash, type NormalizedJob } from "@/lib/ingest/normalize";
import { FETCHERS, splitTokens, type RawPosting, type SyncedSource } from "@/lib/ingest/sources";
import { listingCutoff } from "@/lib/listing-age";

export type CompanySyncResult = {
  slug: string;
  name: string;
  ok: boolean;
  error?: string;
  fetched: number;
  listed: number;
  withSalary: number;
  created: number;
  updated: number;
  expired: number;
  /** New roles whose description wasn't fetched yet (time or per-run limit); picked up next run. */
  pending: number;
};

type CompanyRow = { id: string; slug: string; name: string; atsSource: JobSource | null; atsToken: string | null };

/** Descriptions fetched per company per run, so one huge employer can't starve the rest. */
const DETAIL_LIMIT = 250;
const DETAIL_CONCURRENCY = 5;

/** Creates the bootstrap companies that don't exist yet. Never overwrites edits made in /admin. */
export async function ensureBootstrapCompanies() {
  await db.company.createMany({
    data: BOOTSTRAP_COMPANIES.map((c) => ({
      slug: c.slug,
      name: c.name,
      website: c.website,
      atsSource: c.atsSource,
      atsToken: c.atsToken,
    })),
    skipDuplicates: true,
  });
}

/** Stable, readable slug: "senior-backend-engineer-okta-3f9c1a". Set once, never changed. */
function syncedSlug(source: SyncedSource, job: NormalizedJob, companyName: string) {
  const suffix = createHash("sha1").update(`${source}:${job.externalId}`).digest("hex").slice(0, 6);
  return `${slugify(`${job.title} ${companyName}`).slice(0, 90)}-${suffix}`;
}

function rowData(job: NormalizedJob, companyName: string) {
  const disclosed = job.salaryMin != null && job.salaryMax != null;
  return {
    title: job.title,
    description: job.description,
    discipline: job.discipline,
    level: job.level,
    employmentType: job.employmentType,
    tags: job.tags,
    location: job.location,
    remote: job.remote,
    remoteRegion: job.remoteRegion,
    salaryMin: disclosed ? job.salaryMin : null,
    salaryMax: disclosed ? job.salaryMax : null,
    currency: disclosed ? ("INR" as const) : null,
    salaryDisclosed: disclosed,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    applyUrl: job.applyUrl,
    contentHash: job.contentHash,
    searchText: buildSearchText({ ...job, companyName }),
  } satisfies Prisma.JobUncheckedUpdateInput;
}

const emptyResult = (c: CompanyRow) => ({
  slug: c.slug,
  name: c.name,
  fetched: 0,
  listed: 0,
  withSalary: 0,
  created: 0,
  updated: 0,
  expired: 0,
  pending: 0,
});

/** Runs `fn` over `items` with at most `limit` in flight, stopping early once `stop()` is true. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, stop = () => false) {
  const results: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length && !stop()) {
        const item = items[next++]!;
        results.push(await fn(item));
      }
    }),
  );
  return results;
}

export async function syncCompany(company: CompanyRow, deadline = Infinity): Promise<CompanySyncResult> {
  const base = emptyResult(company);
  const source = company.atsSource;
  if (!source || source === "MANUAL" || !company.atsToken) {
    return { ...base, ok: false, error: "No job-board feed configured" };
  }
  const since = listingCutoff();

  let raw: RawPosting[] = [];
  try {
    for (const token of splitTokens(company.atsToken)) raw.push(...(await FETCHERS[source](token, { since })));
  } catch (err) {
    const error = `Fetch failed: ${(err as Error).message}`.slice(0, 500);
    // Keep existing listings: a flaky feed must not wipe a company off the site.
    await db.company.update({ where: { id: company.id }, data: { lastSyncError: error } });
    return { ...base, ok: false, error };
  }
  // The same role can appear on two of a company's career sites.
  raw = [...new Map(raw.map((p) => [p.externalId, p])).values()];

  const existing = await db.job.findMany({
    where: { companyId: company.id, source },
    select: { id: true, externalId: true, contentHash: true, status: true },
  });

  if (raw.length === 0 && existing.some((j) => j.status === "ACTIVE")) {
    const error = "Feed returned no recent India roles; kept existing listings until the next sync";
    await db.company.update({ where: { id: company.id }, data: { lastSyncError: error } });
    return { ...base, ok: false, error };
  }

  const rawById = new Map(raw.map((p) => [p.externalId, p]));
  const jobs = dedupe(
    raw.flatMap((p) => {
      const r = normalizePosting(p, since);
      return "job" in r ? [r.job] : [];
    }),
    // When per-city copies merge, the one already listed stays the listing, run after run.
    new Map(existing.flatMap((j) => (j.externalId ? [[j.externalId, j.status === "ACTIVE"] as const] : []))),
  );

  const byExternalId = new Map(existing.map((j) => [j.externalId, j]));
  const now = new Date();
  const creates: Prisma.JobCreateManyInput[] = [];
  const updates: { id: string; data: Prisma.JobUncheckedUpdateInput }[] = [];
  const unchanged: string[] = [];
  const needDetail: NormalizedJob[] = [];

  const createRow = (job: NormalizedJob): Prisma.JobCreateManyInput => ({
    ...rowData(job, company.name),
    slug: syncedSlug(source, job, company.name),
    companyId: company.id,
    source,
    externalId: job.externalId,
    postedAt: job.postedAt,
    lastVerifiedAt: now,
    status: "ACTIVE",
  });

  for (const job of jobs) {
    const prev = byExternalId.get(job.externalId);
    const hasDetail = Boolean(rawById.get(job.externalId)?.detail);
    if (!prev) {
      if (hasDetail) needDetail.push(job);
      else creates.push(createRow(job));
    } else if (hasDetail || prev.contentHash === job.contentHash) {
      // Search-style sources list roles without descriptions, so a listed role is simply confirmed.
      unchanged.push(prev.id);
    } else {
      updates.push({ id: prev.id, data: { ...rowData(job, company.name), status: "ACTIVE", lastVerifiedAt: now } });
    }
  }

  // Fetch descriptions for new roles only; whatever doesn't fit in this run is picked up next time.
  const batch = needDetail.slice(0, DETAIL_LIMIT);
  let detailed = 0;
  const hydrated = await mapLimit(
    batch,
    DETAIL_CONCURRENCY,
    async (listed) => {
      detailed++;
      const p = rawById.get(listed.externalId)!;
      try {
        const d = await p.detail!();
        const merged: RawPosting = {
          ...p,
          ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)),
          detail: undefined,
        };
        const r = normalizePosting(merged, since);
        if (!("job" in r)) return null;
        return rehash({ ...r.job, location: mergeLocations(r.job.location, listed.location) });
      } catch {
        return null; // One broken posting shouldn't fail the company; it's retried next run.
      }
    },
    () => Date.now() > deadline,
  );
  for (const job of hydrated) if (job) creates.push(createRow(job));

  if (creates.length > 0) await db.job.createMany({ data: creates, skipDuplicates: true });
  for (let i = 0; i < updates.length; i += 10) {
    await Promise.all(updates.slice(i, i + 10).map((u) => db.job.update({ where: { id: u.id }, data: u.data })));
  }
  if (unchanged.length > 0) {
    // Still listed on the company's careers page: confirm it and bring back anything we had expired.
    await db.job.updateMany({ where: { id: { in: unchanged } }, data: { lastVerifiedAt: now, status: "ACTIVE" } });
  }
  // Gone from the careers page (or no longer recent), so it comes down here too.
  const { count: expired } = await db.job.updateMany({
    where: {
      companyId: company.id,
      source,
      status: "ACTIVE",
      externalId: { notIn: jobs.map((j) => j.externalId) },
    },
    data: { status: "EXPIRED" },
  });

  const live = jobs.length - (needDetail.length - hydrated.filter(Boolean).length);
  await db.company.update({
    where: { id: company.id },
    data: { lastSyncedAt: now, lastSyncError: null, lastSyncJobCount: live },
  });

  const all = [
    ...jobs.filter((j) => !needDetail.includes(j)),
    ...hydrated.filter((j): j is NormalizedJob => j !== null),
  ];
  return {
    ...base,
    ok: true,
    fetched: raw.length,
    listed: live,
    withSalary: all.filter((j) => j.salaryMin != null).length,
    created: creates.length,
    updated: updates.length,
    expired,
    pending: needDetail.length - detailed,
  };
}

/** Deletes every listing posted 30 or more days ago, whatever its source or status. */
export async function purgeOldJobs() {
  const { count } = await db.job.deleteMany({ where: { postedAt: { lt: listingCutoff() } } });
  return count;
}

export type SyncRun = { results: CompanySyncResult[]; remaining: number; purged: number };

/**
 * Syncs the companies that were synced least recently, as many as fit in
 * `budgetMs` (a serverless function has ~300s). Run it again to continue; the
 * daily crons are spread out so every company is covered each day.
 */
export async function syncAll({
  onlySlug,
  budgetMs = Infinity,
}: { onlySlug?: string; budgetMs?: number } = {}): Promise<SyncRun> {
  await ensureBootstrapCompanies();
  const companies = await db.company.findMany({
    where: { atsSource: { not: null }, atsToken: { not: null }, ...(onlySlug ? { slug: onlySlug } : {}) },
    select: { id: true, slug: true, name: true, atsSource: true, atsToken: true },
    orderBy: [{ lastSyncAttemptAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
  });

  const started = Date.now();
  const deadline = started + budgetMs;
  const queue = [...companies];
  const results: CompanySyncResult[] = [];
  const CONCURRENCY = 6;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let c = queue.shift(); c; c = Date.now() < deadline ? queue.shift() : undefined) {
        await db.company.update({ where: { id: c.id }, data: { lastSyncAttemptAt: new Date() } });
        try {
          // Leave headroom after the deadline for the writes of in-flight companies.
          results.push(await syncCompany(c, deadline));
        } catch (err) {
          results.push({ ...emptyResult(c), ok: false, error: (err as Error).message.slice(0, 500) });
        }
      }
    }),
  );

  const purged = await purgeOldJobs();
  return { results: results.sort((a, b) => a.name.localeCompare(b.name)), remaining: queue.length, purged };
}
