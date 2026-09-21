import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Currency, Discipline, Level } from "@/lib/generated/prisma/enums";
import type { JobSearchParams } from "@/lib/validators";

/**
 * Every read goes through here. Reads are wrapped in `use cache` and tagged so
 * admin writes and the expiry cron can invalidate them (see lib/revalidate.ts).
 */
export const TAGS = {
  jobs: "jobs",
  job: (slug: string) => `job:${slug}`,
  companies: "companies",
  company: (slug: string) => `company:${slug}`,
} as const;

export const PAGE_SIZE = 20;

const jobCardSelect = {
  id: true,
  slug: true,
  title: true,
  tags: true,
  location: true,
  remote: true,
  remoteRegion: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  salaryDisclosed: true,
  postedAt: true,
  company: { select: { name: true, slug: true, logoUrl: true } },
} satisfies Prisma.JobSelect;

export type JobCardData = Prisma.JobGetPayload<{ select: typeof jobCardSelect }>;

const ACTIVE = { status: "ACTIVE" } as const;

// ---------------------------------------------------------------- home page

export async function getHomeData() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.jobs, TAGS.companies);

  const [recommended, totalActive, withSalary, byDiscipline, hiringCompanies] = await Promise.all([
    db.job.findMany({
      where: ACTIVE,
      select: jobCardSelect,
      // Salary-first: roles that publish pay lead, then featured, then newest.
      orderBy: [{ salaryDisclosed: "desc" }, { featured: "desc" }, { postedAt: "desc" }, { id: "desc" }],
      take: 6,
    }),
    db.job.count({ where: ACTIVE }),
    db.job.count({ where: { ...ACTIVE, salaryDisclosed: true } }),
    db.job.groupBy({ by: ["discipline"], where: ACTIVE, _count: { _all: true } }),
    // The companies with the most open roles right now.
    db.company.findMany({
      where: { jobs: { some: ACTIVE } },
      select: { name: true, slug: true },
      orderBy: { jobs: { _count: "desc" } },
      take: 8,
    }),
  ]);

  const disciplineCounts = Object.fromEntries(
    byDiscipline.map((d) => [d.discipline, d._count._all]),
  ) as Partial<Record<Discipline, number>>;

  return { recommended, totalActive, withSalary, disciplineCounts, hiringCompanies };
}

// ---------------------------------------------------------------- search

type SearchFilters = Omit<JobSearchParams, "cursor">;

function buildWhere(f: SearchFilters): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [ACTIVE];

  if (f.q) {
    // Every word must match; searchText is lowercased and trigram-indexed.
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const word of words) and.push({ searchText: { contains: word } });
  }
  if (f.location) {
    if (/^remote$/i.test(f.location)) {
      and.push({ remote: "REMOTE" });
    } else {
      and.push({
        OR: [
          { location: { contains: f.location, mode: "insensitive" } },
          { remoteRegion: { contains: f.location, mode: "insensitive" } },
        ],
      });
    }
  }
  if (f.remote) and.push({ remote: f.remote });
  if (f.discipline) and.push({ discipline: f.discipline });
  if (f.level) and.push({ level: f.level });
  if (f.city) and.push({ location: { contains: f.city } });
  if (f.salary) and.push({ salaryDisclosed: true });
  if (f.currency) and.push({ currency: f.currency });
  // Minimum pay is in rupees; only roles that publish an INR band can match.
  if (f.minSalary) and.push({ currency: "INR", salaryMax: { gte: f.minSalary } });
  if (f.tag) and.push({ tags: { has: f.tag } });

  return { AND: and };
}

export async function searchJobs(params: JobSearchParams) {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.jobs);

  const { cursor, ...filters } = params;
  const where = buildWhere(filters);

  const [rows, total] = await Promise.all([
    db.job.findMany({
      where,
      select: jobCardSelect,
      orderBy: [{ salaryDisclosed: "desc" }, { postedAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    db.job.count({ where }),
  ]);

  const hasMore = rows.length > PAGE_SIZE;
  const jobs = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return { jobs, total, nextCursor: hasMore ? jobs[jobs.length - 1]!.id : null };
}

export async function getJobsByIds(ids: string[]) {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.jobs);

  if (ids.length === 0) return [];
  return db.job.findMany({
    where: { id: { in: ids } },
    select: { ...jobCardSelect, status: true },
  });
}

// ---------------------------------------------------------------- job detail

export async function getJobBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.jobs, TAGS.job(slug));

  return db.job.findUnique({
    where: { slug },
    include: {
      company: {
        select: {
          name: true,
          slug: true,
          logoUrl: true,
          website: true,
          description: true,
          hq: true,
          size: true,
          medianResponseDays: true,
          atsSource: true,
        },
      },
    },
  });
}

export async function getSimilarJobs(jobId: string, discipline: Discipline) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.jobs);

  return db.job.findMany({
    where: { ...ACTIVE, discipline, id: { not: jobId } },
    select: jobCardSelect,
    orderBy: [{ salaryDisclosed: "desc" }, { postedAt: "desc" }],
    take: 4,
  });
}

// ---------------------------------------------------------------- companies

export async function getCompanies() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.companies, TAGS.jobs);

  const companies = await db.company.findMany({
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      hq: true,
      size: true,
      medianResponseDays: true,
      _count: { select: { jobs: { where: ACTIVE } } },
    },
    orderBy: { name: "asc" },
  });
  return companies
    .map(({ _count, ...c }) => ({ ...c, openRoles: _count.jobs }))
    .sort((a, b) => b.openRoles - a.openRoles || a.name.localeCompare(b.name));
}

export async function getCompanyBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.companies, TAGS.company(slug), TAGS.jobs);

  return db.company.findUnique({
    where: { slug },
    include: {
      jobs: {
        where: ACTIVE,
        select: jobCardSelect,
        orderBy: [{ salaryDisclosed: "desc" }, { postedAt: "desc" }],
        take: 200,
      },
    },
  });
}

// ---------------------------------------------------------------- salaries

export type SalaryRow = {
  discipline: Discipline;
  level: Level;
  currency: Currency;
  roles: number;
  p25: number;
  median: number;
  p75: number;
};

export async function getSalaryStats() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.jobs);

  // Midpoint of each band, bucketed by discipline × level × currency.
  const rows = await db.$queryRaw<
    {
      discipline: Discipline;
      level: Level;
      currency: Currency;
      roles: bigint;
      p25: number;
      median: number;
      p75: number;
    }[]
  >`
    SELECT "discipline", "level", "currency",
           COUNT(*)                                                         AS roles,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) AS p25,
           percentile_cont(0.5)  WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) AS median,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY ("salaryMin" + "salaryMax") / 2.0) AS p75
    FROM "Job"
    WHERE "status" = 'ACTIVE' AND "salaryDisclosed" AND "currency" = 'INR'
    GROUP BY "discipline", "level", "currency"
    HAVING COUNT(*) >= 2
    ORDER BY "discipline", "level", "currency"
  `;

  return rows.map<SalaryRow>((r) => ({
    discipline: r.discipline,
    level: r.level,
    currency: r.currency,
    roles: Number(r.roles),
    p25: Math.round(Number(r.p25)),
    median: Math.round(Number(r.median)),
    p75: Math.round(Number(r.p75)),
  }));
}

// ---------------------------------------------------------------- sitemap

export async function getSitemapData() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.jobs, TAGS.companies);

  const [jobs, companies] = await Promise.all([
    db.job.findMany({
      where: ACTIVE,
      select: { slug: true, lastVerifiedAt: true },
      orderBy: { postedAt: "desc" },
      take: 45_000,
    }),
    db.company.findMany({ select: { slug: true, updatedAt: true } }),
  ]);
  return { jobs, companies };
}
