import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { JobSource } from "@/lib/generated/prisma/enums";
import { buildSearchText, slugify } from "@/lib/format";
import { BOOTSTRAP_COMPANIES } from "@/lib/ingest/companies";
import { dedupe, normalizePosting, type NormalizedJob } from "@/lib/ingest/normalize";
import { FETCHERS } from "@/lib/ingest/sources";

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
};

type SyncedSource = Exclude<JobSource, "MANUAL">;
type CompanyRow = { id: string; slug: string; name: string; atsSource: JobSource | null; atsToken: string | null };

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
  return `${slugify(`${job.title} ${companyName}`)}-${suffix}`;
}

function rowData(job: NormalizedJob, companyName: string) {
  const disclosed = job.salaryMin != null && job.salaryMax != null;
  return {
    title: job.title,
    description: job.description,
    discipline: job.discipline,
    level: job.level,
    tags: job.tags,
    location: job.location,
    remote: job.remote,
    remoteRegion: job.remoteRegion,
    salaryMin: disclosed ? job.salaryMin : null,
    salaryMax: disclosed ? job.salaryMax : null,
    currency: disclosed ? ("INR" as const) : null,
    salaryDisclosed: disclosed,
    applyUrl: job.applyUrl,
    contentHash: job.contentHash,
    searchText: buildSearchText({ ...job, companyName }),
  } satisfies Prisma.JobUncheckedUpdateInput;
}

export async function syncCompany(company: CompanyRow): Promise<CompanySyncResult> {
  const base = { slug: company.slug, name: company.name, fetched: 0, listed: 0, withSalary: 0, created: 0, updated: 0, expired: 0 };
  const source = company.atsSource;
  if (!source || source === "MANUAL" || !company.atsToken) {
    return { ...base, ok: false, error: "No job-board feed configured" };
  }

  let raw;
  try {
    raw = await FETCHERS[source](company.atsToken);
  } catch (err) {
    const error = `Fetch failed: ${(err as Error).message}`.slice(0, 500);
    // Keep existing listings: a flaky feed must not wipe a company off the site.
    await db.company.update({ where: { id: company.id }, data: { lastSyncError: error } });
    return { ...base, ok: false, error };
  }

  const existing = await db.job.findMany({
    where: { companyId: company.id, source },
    select: { id: true, externalId: true, contentHash: true, status: true },
  });

  if (raw.length === 0 && existing.some((j) => j.status === "ACTIVE")) {
    const error = "Feed returned no jobs at all; kept existing listings until the next sync";
    await db.company.update({ where: { id: company.id }, data: { lastSyncError: error } });
    return { ...base, ok: false, error };
  }

  const jobs = dedupe(
    raw.flatMap((p) => {
      const r = normalizePosting(p);
      return "job" in r ? [r.job] : [];
    }),
  );

  const byExternalId = new Map(existing.map((j) => [j.externalId, j]));
  const now = new Date();
  const creates: Prisma.JobCreateManyInput[] = [];
  const updates: { id: string; data: Prisma.JobUncheckedUpdateInput }[] = [];
  const unchanged: string[] = [];

  for (const job of jobs) {
    const prev = byExternalId.get(job.externalId);
    if (!prev) {
      creates.push({
        ...rowData(job, company.name),
        slug: syncedSlug(source, job, company.name),
        companyId: company.id,
        source,
        externalId: job.externalId,
        postedAt: job.postedAt,
        lastVerifiedAt: now,
        status: "ACTIVE",
      });
    } else if (prev.contentHash !== job.contentHash) {
      updates.push({ id: prev.id, data: { ...rowData(job, company.name), status: "ACTIVE", lastVerifiedAt: now } });
    } else {
      unchanged.push(prev.id);
    }
  }

  if (creates.length > 0) await db.job.createMany({ data: creates, skipDuplicates: true });
  for (let i = 0; i < updates.length; i += 10) {
    await Promise.all(updates.slice(i, i + 10).map((u) => db.job.update({ where: { id: u.id }, data: u.data })));
  }
  if (unchanged.length > 0) {
    // Still listed on the company's careers page: confirm it and bring back anything we had expired.
    await db.job.updateMany({ where: { id: { in: unchanged } }, data: { lastVerifiedAt: now, status: "ACTIVE" } });
  }
  // Gone from the careers page, so it comes down here too.
  const { count: expired } = await db.job.updateMany({
    where: {
      companyId: company.id,
      source,
      status: "ACTIVE",
      externalId: { notIn: jobs.map((j) => j.externalId) },
    },
    data: { status: "EXPIRED" },
  });

  await db.company.update({
    where: { id: company.id },
    data: { lastSyncedAt: now, lastSyncError: null, lastSyncJobCount: jobs.length },
  });

  return {
    ...base,
    ok: true,
    fetched: raw.length,
    listed: jobs.length,
    withSalary: jobs.filter((j) => j.salaryMin != null).length,
    created: creates.length,
    updated: updates.length,
    expired,
  };
}

/** Syncs every company that has a feed (or just `onlySlug`), a few at a time. */
export async function syncAll(onlySlug?: string) {
  await ensureBootstrapCompanies();
  const companies = await db.company.findMany({
    where: { atsSource: { not: null }, atsToken: { not: null }, ...(onlySlug ? { slug: onlySlug } : {}) },
    select: { id: true, slug: true, name: true, atsSource: true, atsToken: true },
    orderBy: { name: "asc" },
  });

  const results: CompanySyncResult[] = [];
  const queue = [...companies];
  const CONCURRENCY = 4;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        try {
          results.push(await syncCompany(c));
        } catch (err) {
          results.push({
            slug: c.slug,
            name: c.name,
            ok: false,
            error: (err as Error).message.slice(0, 500),
            fetched: 0,
            listed: 0,
            withSalary: 0,
            created: 0,
            updated: 0,
            expired: 0,
          });
        }
      }
    }),
  );

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
