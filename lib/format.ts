import type {
  ApplicationStage,
  Currency,
  Discipline,
  EducationLevel,
  EmploymentType,
  Industry,
  Level,
  RemotePolicy,
} from "@/lib/generated/prisma/enums";

const moneyFormatters = new Map<Currency, Intl.NumberFormat>();

const LAKH = 100_000;
const CRORE = 10_000_000;
const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString();

/** 1850000 → "18.5 L", 12000000 → "1.2 Cr" (the way Indian salaries are quoted). */
export function formatInrShort(amount: number) {
  return amount >= CRORE ? `${oneDecimal(amount / CRORE)} Cr` : `${oneDecimal(amount / LAKH)} L`;
}

export function formatMoney(amount: number, currency: Currency) {
  if (currency === "INR") return `₹${formatInrShort(amount)}`;
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

/**
 * "₹18–25 LPA", "₹80 L – ₹1.2 Cr", "€95,000 – €125,000".
 * Returns null when the employer hasn't published a band.
 */
export function formatSalaryBand(min: number | null, max: number | null, currency: Currency | null) {
  if (min == null || max == null || currency == null) return null;
  if (currency === "INR") {
    if (max < CRORE) {
      const lo = oneDecimal(min / LAKH);
      const hi = oneDecimal(max / LAKH);
      return lo === hi ? `₹${lo} LPA` : `₹${lo}–${hi} LPA`;
    }
    return min === max ? `₹${formatInrShort(min)}` : `₹${formatInrShort(min)} – ₹${formatInrShort(max)}`;
  }
  return min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
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

/** Compact age for cards: "Today", "3d", "2w". */
export function formatAge(date: Date, now: Date = new Date()) {
  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY));
  if (days === 0) return "Today";
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
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
  INTERN: "Intern",
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

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
};

export const INDUSTRY_LABEL: Record<Industry, string> = {
  SAAS: "SaaS",
  FINTECH: "Fintech",
  ECOMMERCE: "E-commerce",
  HEALTHTECH: "Healthtech",
  EDTECH: "Edtech",
  GAMING: "Gaming",
  AI_ML: "AI & ML",
  SECURITY: "Security",
  CONSUMER: "Consumer",
  MOBILITY: "Mobility",
  LOGISTICS: "Logistics",
  MEDIA: "Media",
  IT_SERVICES: "IT services",
  HARDWARE: "Hardware",
  ENERGY: "Energy",
  OTHER: "Other",
};

export const EDUCATION_LABEL: Record<EducationLevel, string> = {
  HIGH_SCHOOL: "Class 12 / high school",
  DIPLOMA: "Diploma",
  BACHELORS: "Bachelor's",
  MASTERS: "Master's",
  DOCTORATE: "Doctorate",
  OTHER: "Other",
};

/** Wording is the candidate's own view: this is their record, not the employer's. */
export const APPLICATION_STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Not selected",
  GHOSTED: "No reply",
};

/** "Bengaluru · Pune", "Remote (India)", "Hybrid · Gurugram" */
export function formatJobLocation(job: { location: string; remote: RemotePolicy; remoteRegion: string | null }) {
  if (job.remote === "REMOTE") {
    const region = job.remoteRegion ? `Remote (${job.remoteRegion})` : "Remote";
    const hasCities = job.location && job.location !== "India" && job.location !== job.remoteRegion;
    return hasCities ? `${region} · ${job.location}` : region;
  }
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
