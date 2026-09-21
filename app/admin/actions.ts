"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdminAuthorization } from "@/lib/admin-auth";
import { createCompany, createJob, jobSlug, salaryFields, updateCompany, updateJob } from "@/lib/admin-jobs";
import { csvToRecords } from "@/lib/csv";
import { db } from "@/lib/db";
import { buildSearchText } from "@/lib/format";
import { syncAll } from "@/lib/ingest/sync";
import { revalidateCompanies, revalidateJobs } from "@/lib/revalidate";
import type { Prisma } from "@/lib/generated/prisma/client";
import { companyInputSchema, jobInputSchema } from "@/lib/validators";

export type FormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

/**
 * proxy.ts already guards /admin, but server actions are POST endpoints,
 * so every action re-checks the credentials itself.
 */
async function requireAdmin() {
  const h = await headers();
  if (!isAdminAuthorization(h.get("authorization"))) throw new Error("Unauthorized");
}

const idSchema = z.string().regex(/^[a-z0-9]{10,40}$/i);

// ---------------------------------------------------------------- jobs

export async function saveJob(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = jobInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { message: "Please fix the highlighted fields.", errors: z.flattenError(parsed.error).fieldErrors };
  }

  const id = formData.get("id");
  const job =
    typeof id === "string" && id ? await updateJob(idSchema.parse(id), parsed.data) : await createJob(parsed.data);

  revalidateJobs([job.slug]);
  revalidateCompanies();
  redirect(`/admin?saved=${job.slug}`);
}

export async function setJobStatus(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse(formData.get("id"));
  const status = z.enum(["ACTIVE", "EXPIRED"]).parse(formData.get("status"));

  const job = await db.job.update({
    where: { id },
    // Re-activating is an explicit confirmation that the role is open.
    data: status === "ACTIVE" ? { status, lastVerifiedAt: new Date() } : { status },
    select: { slug: true },
  });
  revalidateJobs([job.slug]);
  revalidateCompanies();
}

/** "Still open" — the weekly employer confirmation that resets the expiry clock. */
export async function confirmJob(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse(formData.get("id"));
  const job = await db.job.update({
    where: { id },
    data: { lastVerifiedAt: new Date(), status: "ACTIVE" },
    select: { slug: true },
  });
  revalidateJobs([job.slug]);
}

export async function deleteJob(formData: FormData) {
  await requireAdmin();
  const id = idSchema.parse(formData.get("id"));
  const job = await db.job.delete({ where: { id }, select: { slug: true } });
  revalidateJobs([job.slug]);
  revalidateCompanies();
  redirect("/admin");
}

// ---------------------------------------------------------------- companies

export async function saveCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = companyInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { message: "Please fix the highlighted fields.", errors: z.flattenError(parsed.error).fieldErrors };
  }

  const id = formData.get("id");
  const company =
    typeof id === "string" && id
      ? await updateCompany(idSchema.parse(id), parsed.data)
      : await createCompany(parsed.data);

  revalidateCompanies([company.slug]);
  revalidateJobs();
  redirect("/admin/companies");
}

// ---------------------------------------------------------------- CSV import

const MAX_IMPORT_ROWS = 500;

export async function importJobs(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const file = formData.get("file");
  const pasted = formData.get("csv");
  const text =
    file instanceof File && file.size > 0
      ? file.size > 2_000_000
        ? null
        : await file.text()
      : typeof pasted === "string"
        ? pasted
        : "";
  if (text === null) return { message: "File is larger than 2 MB. Split it into smaller imports." };

  const records = csvToRecords(text);
  if (records.length === 0) return { message: "No rows found. Include a header row." };
  if (records.length > MAX_IMPORT_ROWS) return { message: `Import at most ${MAX_IMPORT_ROWS} rows at a time.` };

  const companies = await db.company.findMany({ select: { id: true, slug: true, name: true } });
  const bySlug = new Map(companies.map((c) => [c.slug, c]));

  const errors: string[] = [];
  const rows: Prisma.JobCreateManyInput[] = [];

  records.forEach((r, i) => {
    const line = i + 2; // +1 for the header, +1 for 1-based numbering
    const company = bySlug.get(r.company_slug ?? "");
    if (!company) {
      errors.push(`Row ${line}: unknown company_slug "${r.company_slug ?? ""}"`);
      return;
    }
    const parsed = jobInputSchema.safeParse({
      title: r.title,
      companyId: company.id,
      description: r.description,
      discipline: r.discipline?.toUpperCase(),
      level: r.level?.toUpperCase(),
      tags: (r.tags ?? "").replace(/;/g, ","),
      location: r.location,
      remote: r.remote?.toUpperCase(),
      remoteRegion: r.remote_region,
      salaryMin: r.salary_min,
      salaryMax: r.salary_max,
      currency: r.currency ? r.currency.toUpperCase() : undefined,
      applyUrl: r.apply_url,
      featured: r.featured,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ");
      errors.push(`Row ${line}: ${issues}`);
      return;
    }
    const d = parsed.data;
    rows.push({
      ...d,
      ...salaryFields(d),
      remoteRegion: d.remoteRegion ?? null,
      slug: jobSlug(d.title, company.name),
      searchText: buildSearchText({ ...d, companyName: company.name }),
    });
  });

  // All-or-nothing: a half-imported sheet is harder to fix than a rejected one.
  if (errors.length > 0) {
    return { message: `Nothing imported. ${errors.length} row(s) need fixing.`, errors: { rows: errors.slice(0, 50) } };
  }

  const { count } = await db.job.createMany({ data: rows });
  revalidateJobs();
  revalidateCompanies();
  return { message: `Imported ${count} role(s).` };
}

// ---------------------------------------------------------------- job-board sync

export type SyncState = { message?: string; failed?: string[] };

/** Same as the daily cron, on demand from /admin/companies. */
export async function syncNow(_prev: SyncState, formData: FormData): Promise<SyncState> {
  await requireAdmin();
  const only = formData.get("company");
  // Time-boxed like the cron: the least recently synced companies go first; click again to continue.
  const { results, remaining, purged } = await syncAll({
    onlySlug: typeof only === "string" && only ? only : undefined,
    budgetMs: 200_000,
  });
  revalidateJobs();
  revalidateCompanies();
  const listed = results.reduce((n, r) => n + r.listed, 0);
  const created = results.reduce((n, r) => n + r.created, 0);
  const expired = results.reduce((n, r) => n + r.expired, 0);
  return {
    message:
      `Synced ${results.length} companies: ${listed} live roles (${created} new, ${expired} taken down, ${purged} over 30 days deleted).` +
      (remaining > 0 ? ` ${remaining} companies left for the next run — click again to continue.` : ""),
    failed: results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.error}`),
  };
}
