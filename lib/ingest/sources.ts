import type { JobSource } from "@/lib/generated/prisma/enums";
import { decodeEntities, htmlToText } from "@/lib/ingest/html";

/** One posting as published by a company's job board, before any filtering. */
export type RawPosting = {
  externalId: string;
  title: string;
  locations: string[];
  workplace: "REMOTE" | "HYBRID" | "ONSITE" | null;
  department: string | null;
  /** Description already converted to the site's plain-text format. */
  description: string;
  applyUrl: string;
  postedAt: Date;
  /** Structured pay when the board provides it (Lever, Ashby). */
  pay: { min: number; max: number; currency: string; interval: string } | null;
};

const TIMEOUT_MS = 45_000;
const UA = "LodestarJobsBot/1.0 (+https://loadestar.vercel.app/about)";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

const date = (v: unknown) => {
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

// ------------------------------------------------------------------ Greenhouse
// https://developers.greenhouse.io/job-board.html (public, no key)

type GhJob = {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  first_published?: string;
  location?: { name?: string };
  offices?: { name?: string; location?: string }[];
  departments?: { name?: string }[];
  content?: string;
};

async function greenhouse(token: string): Promise<RawPosting[]> {
  const data = await getJson<{ jobs: GhJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
  );
  return data.jobs.map((j) => ({
    externalId: String(j.id),
    title: j.title.trim(),
    locations: [j.location?.name ?? "", ...(j.offices ?? []).flatMap((o) => [o.name ?? "", o.location ?? ""])].filter(Boolean),
    workplace: null,
    department: j.departments?.[0]?.name ?? null,
    // Greenhouse double-encodes content: decode once to get HTML.
    description: htmlToText(decodeEntities(j.content ?? "")),
    applyUrl: j.absolute_url,
    postedAt: date(j.first_published ?? j.updated_at),
    pay: null,
  }));
}

// ------------------------------------------------------------------ Lever
// https://github.com/lever/postings-api (public, no key)

type LeverJob = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt: number;
  workplaceType?: string;
  categories?: { location?: string; allLocations?: string[]; team?: string; department?: string };
  description?: string;
  lists?: { text: string; content: string }[];
  additional?: string;
  salaryRange?: { min: number; max: number; currency: string; interval: string };
};

async function lever(token: string): Promise<RawPosting[]> {
  const data = await getJson<LeverJob[]>(`https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`);
  return data.map((j) => {
    const html = [
      j.description ?? "",
      ...(j.lists ?? []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`),
      j.additional ?? "",
    ].join("");
    return {
      externalId: j.id,
      title: j.text.trim(),
      locations: [j.categories?.location ?? "", ...(j.categories?.allLocations ?? [])].filter(Boolean),
      workplace: workplaceOf(j.workplaceType),
      department: j.categories?.department ?? j.categories?.team ?? null,
      description: htmlToText(html),
      applyUrl: j.hostedUrl,
      postedAt: date(j.createdAt),
      pay: j.salaryRange ?? null,
    };
  });
}

// ------------------------------------------------------------------ Ashby
// https://developers.ashbyhq.com/docs/public-job-posting-api (public, no key)

type AshbyJob = {
  id: string;
  title: string;
  jobUrl: string;
  publishedAt: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  department?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  address?: { postalAddress?: { addressCountry?: string; addressLocality?: string } };
  descriptionHtml?: string;
  compensation?: {
    summaryComponents?: {
      compensationType: string;
      interval: string;
      currencyCode: string | null;
      minValue: number | null;
      maxValue: number | null;
    }[];
  };
};

async function ashby(token: string): Promise<RawPosting[]> {
  const data = await getJson<{ jobs: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`,
  );
  return data.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const salary = j.compensation?.summaryComponents?.find(
        (c) => c.compensationType === "Salary" && c.minValue != null && c.maxValue != null && c.currencyCode,
      );
      const addr = j.address?.postalAddress;
      return {
        externalId: j.id,
        title: j.title.trim(),
        locations: [
          j.location ?? "",
          ...(j.secondaryLocations ?? []).map((s) => s.location ?? ""),
          [addr?.addressLocality, addr?.addressCountry].filter(Boolean).join(", "),
        ].filter(Boolean),
        workplace: workplaceOf(j.workplaceType) ?? (j.isRemote ? "REMOTE" : null),
        department: j.department ?? null,
        description: htmlToText(j.descriptionHtml ?? ""),
        applyUrl: j.jobUrl,
        postedAt: date(j.publishedAt),
        pay: salary
          ? { min: salary.minValue!, max: salary.maxValue!, currency: salary.currencyCode!, interval: salary.interval }
          : null,
      };
    });
}

function workplaceOf(v?: string | null): RawPosting["workplace"] {
  if (!v) return null;
  if (/remote/i.test(v)) return "REMOTE";
  if (/hybrid/i.test(v)) return "HYBRID";
  if (/on-?site|office/i.test(v)) return "ONSITE";
  return null;
}

export const FETCHERS: Record<Exclude<JobSource, "MANUAL">, (token: string) => Promise<RawPosting[]>> = {
  GREENHOUSE: greenhouse,
  LEVER: lever,
  ASHBY: ashby,
};

/** The company's public careers page for a board, used as its website fallback. */
export function boardUrl(source: Exclude<JobSource, "MANUAL">, token: string) {
  return {
    GREENHOUSE: `https://job-boards.greenhouse.io/${token}`,
    LEVER: `https://jobs.lever.co/${token}`,
    ASHBY: `https://jobs.ashbyhq.com/${token}`,
  }[source];
}
