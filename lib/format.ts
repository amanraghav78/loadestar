import type { Currency, Discipline, Level, RemotePolicy } from "@/lib/generated/prisma/enums";

const moneyFormatters = new Map<Currency, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: Currency) {
  let fmt = moneyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    moneyFormatters.set(currency, fmt);
  }
  return fmt.format(amount);
}

export function formatSalaryBand(min: number, max: number, currency: Currency) {
  return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}

const DAY = 24 * 60 * 60 * 1000;

/** "2 days ago", "1 week ago" — matches the tone of the listing cards. */
export function formatPostedAgo(date: Date, now: Date = new Date()) {
  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}

export const numberFormat = new Intl.NumberFormat("en-US");

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  ENGINEERING: "Engineering",
  DESIGN: "Design",
  PRODUCT: "Product",
  DATA: "Data",
  SECURITY: "Security",
  INFRASTRUCTURE: "Infrastructure",
};

export const LEVEL_LABEL: Record<Level, string> = {
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  STAFF: "Staff",
  PRINCIPAL: "Principal",
  MANAGER: "Manager",
  DIRECTOR: "Director",
};

export const REMOTE_LABEL: Record<RemotePolicy, string> = {
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

/** "Berlin", "Remote (Europe)", "Hybrid · London" */
export function formatJobLocation(job: {
  location: string;
  remote: RemotePolicy;
  remoteRegion: string | null;
}) {
  if (job.remote === "REMOTE") return job.remoteRegion ? `Remote (${job.remoteRegion})` : "Remote";
  if (job.remote === "HYBRID") return `Hybrid · ${job.location}`;
  return job.location;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Denormalised, lowercased text that the trigram index searches over. */
export function buildSearchText(parts: {
  title: string;
  companyName: string;
  location: string;
  remoteRegion?: string | null;
  tags: string[];
}) {
  return [parts.title, parts.companyName, parts.location, parts.remoteRegion ?? "", ...parts.tags]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
