import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { buildSearchText, slugify } from "@/lib/format";
import type { CompanyInput, JobInput } from "@/lib/validators";

/** Human-readable and unique: "senior-backend-engineer-ingest-arclight-k3f9qa". */
export function jobSlug(title: string, companyName: string) {
  return `${slugify(`${title} ${companyName}`)}-${randomBytes(4).toString("hex").slice(0, 6)}`;
}

async function companyName(companyId: string) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true } });
  return company.name;
}

/** Band columns for the DB check constraint: all set, or all null. */
export function salaryFields(input: Pick<JobInput, "salaryMin" | "salaryMax" | "currency">) {
  const disclosed = input.salaryMin != null && input.salaryMax != null;
  return {
    salaryMin: disclosed ? input.salaryMin! : null,
    salaryMax: disclosed ? input.salaryMax! : null,
    currency: disclosed ? input.currency : null,
    salaryDisclosed: disclosed,
  };
}

/** Experience columns: a minimum and an optional maximum, or both null when the listing doesn't say. */
export function experienceFields(input: Pick<JobInput, "experienceMin" | "experienceMax">) {
  const known = input.experienceMin != null;
  return {
    experienceMin: known ? input.experienceMin! : null,
    experienceMax: known ? (input.experienceMax ?? null) : null,
  };
}

function jobData(input: JobInput, name: string) {
  return {
    title: input.title,
    description: input.description,
    companyId: input.companyId,
    discipline: input.discipline,
    level: input.level,
    employmentType: input.employmentType,
    tags: input.tags,
    location: input.location,
    remote: input.remote,
    remoteRegion: input.remoteRegion ?? null,
    ...salaryFields(input),
    ...experienceFields(input),
    applyUrl: input.applyUrl,
    featured: input.featured,
    searchText: buildSearchText({ ...input, companyName: name }),
  };
}

export async function createJob(input: JobInput) {
  const name = await companyName(input.companyId);
  return db.job.create({
    data: { ...jobData(input, name), slug: jobSlug(input.title, name) },
    select: { id: true, slug: true },
  });
}

export async function updateJob(id: string, input: JobInput) {
  const name = await companyName(input.companyId);
  return db.job.update({
    where: { id },
    // Editing a listing counts as the employer re-confirming it.
    data: { ...jobData(input, name), lastVerifiedAt: new Date() },
    select: { id: true, slug: true },
  });
}

export async function createCompany(input: CompanyInput) {
  const base = slugify(input.name) || "company";
  const taken = await db.company.count({ where: { slug: { startsWith: base } } });
  return db.company.create({
    data: { ...input, slug: taken ? `${base}-${taken + 1}` : base },
    select: { id: true, slug: true },
  });
}

/** Renaming a company changes what its jobs are searchable by, so resync them. */
export async function updateCompany(id: string, input: CompanyInput) {
  return db.$transaction(async (tx) => {
    const company = await tx.company.update({ where: { id }, data: input, select: { id: true, slug: true } });
    const jobs = await tx.job.findMany({
      where: { companyId: id },
      select: { id: true, title: true, location: true, remoteRegion: true, tags: true },
    });
    for (const job of jobs) {
      await tx.job.update({
        where: { id: job.id },
        data: { searchText: buildSearchText({ ...job, companyName: input.name }) },
      });
    }
    return company;
  });
}
