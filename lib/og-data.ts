import type { Currency, JobStatus, RemotePolicy } from "@/lib/generated/prisma/enums";
import { formatJobLocation, formatSalaryBand, numberFormat } from "@/lib/format";

/**
 * What the share images (app/**\/opengraph-image.tsx) print, worked out here
 * so the text rules can be unit-tested without rendering a PNG.
 */

/** Shortens `text` to at most `max` characters, cutting at a word and adding an ellipsis. */
export function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  // Only back up to a word break when one is reasonably close.
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:·(–—-]+$/, "")}…`;
}

/** Big titles for short roles, smaller ones so long titles still fit on three lines. */
export function titleFontSize(title: string) {
  if (title.length <= 28) return 76;
  if (title.length <= 48) return 66;
  if (title.length <= 70) return 56;
  return 48;
}

type OgJob = {
  title: string;
  status: JobStatus;
  location: string;
  remote: RemotePolicy;
  remoteRegion: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: Currency | null;
  company: { name: string };
};

export type JobOgContent = {
  title: string;
  titleSize: number;
  company: string;
  location: string;
  /** The published band, or null: a guessed number would be worse than none. */
  salary: string | null;
  open: boolean;
  alt: string;
};

export function jobOgContent(job: OgJob): JobOgContent {
  const title = truncate(job.title, 90);
  const company = truncate(job.company.name, 40);
  const location = truncate(formatJobLocation(job), 44);
  const salary = formatSalaryBand(job.salaryMin, job.salaryMax, job.currency);
  const open = job.status === "ACTIVE";
  const details = [salary, location].filter(Boolean).join(", ");
  return {
    title,
    titleSize: titleFontSize(title),
    company,
    location,
    salary,
    open,
    alt: `${job.title} at ${job.company.name}${details ? `: ${details}` : ""}${open ? "" : " (no longer open)"}. On Lodestar.`,
  };
}

export type CompanyOgContent = { name: string; nameSize: number; initial: string; roles: string; alt: string };

export function companyOgContent(company: { name: string; openRoles: number }): CompanyOgContent {
  const name = truncate(company.name, 48);
  const roles =
    company.openRoles === 0
      ? "No open roles right now"
      : `${numberFormat.format(company.openRoles)} open ${company.openRoles === 1 ? "role" : "roles"}`;
  return {
    name,
    nameSize: titleFontSize(name) + 8,
    initial: company.name.trim().charAt(0).toUpperCase() || "?",
    roles,
    alt: `${company.name} on Lodestar. ${roles}.`,
  };
}
