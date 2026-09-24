import https from "node:https";
import zlib from "node:zlib";
import { decodeEntities, htmlToText } from "@/lib/ingest/html";
import { splitTokens, type SyncedSource } from "@/lib/ingest/tokens";

export { splitTokens, type SyncedSource };

type Workplace = "REMOTE" | "HYBRID" | "ONSITE" | null;

/** One posting as published by a company's careers site, before any filtering. */
export type RawPosting = {
  /** Unique within its source (prefixed with the tenant where ids are only unique per tenant). */
  externalId: string;
  title: string;
  locations: string[];
  workplace: Workplace;
  department: string | null;
  /** Description already converted to the site's plain-text format ("" until `detail` runs). */
  description: string;
  applyUrl: string;
  postedAt: Date;
  /** Structured pay when the board provides it (Lever, Ashby). */
  pay: { min: number; max: number; currency: string; interval: string } | null;
  /**
   * Search-style APIs (Workday, SmartRecruiters, …) list roles without their
   * description. The sync calls this only for new roles that pass the filters.
   */
  detail?: () => Promise<PostingDetail>;
};

export type PostingDetail = Partial<Pick<RawPosting, "locations" | "workplace" | "postedAt" | "applyUrl">> & {
  description: string;
};

export type FetchOptions = {
  /** Postings older than this are not returned (and search pagination stops early). */
  since: Date;
};

const TIMEOUT_MS = 30_000;
const UA = "LodestarJobsBot/1.0 (+https://loadestar.vercel.app/about)";

type HttpInit = { method?: "GET" | "POST"; body?: string; headers?: Record<string, string> };

// Reuse connections, and stay polite: at most 8 requests in flight per host.
const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });
type HttpResponse = { status: number; text: string };

// Plain node:https rather than fetch: under heavy concurrency against some of
// these hosts, Node's built-in fetch (undici) can hit an internal assertion
// that crashes the whole process instead of rejecting one request.
function http(url: string, init: HttpInit, redirects = 0): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: init.method ?? "GET",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate, br",
          "User-Agent": UA,
          ...init.headers,
        },
        timeout: TIMEOUT_MS,
        agent,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects < 3) {
          res.resume();
          http(new URL(res.headers.location, url).toString(), init, redirects + 1).then(resolve, reject);
          return;
        }
        const encoding = res.headers["content-encoding"];
        const stream =
          encoding === "gzip"
            ? res.pipe(zlib.createGunzip())
            : encoding === "deflate"
              ? res.pipe(zlib.createInflate())
              : encoding === "br"
                ? res.pipe(zlib.createBrotliDecompress())
                : res;
        const chunks: Buffer[] = [];
        stream.on("data", (c: Buffer) => chunks.push(c));
        stream.on("end", () => resolve({ status, text: Buffer.concat(chunks).toString("utf8") }));
        stream.on("error", reject);
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Timed out after ${TIMEOUT_MS / 1000}s`)));
    req.on("error", reject);
    req.end(init.body);
  });
}

async function request<T>(url: string, init: HttpInit = {}, attempt = 0): Promise<T> {
  let res: HttpResponse;
  try {
    res = await http(url, init);
  } catch (err) {
    if (attempt < 2) return retry(url, init, attempt);
    throw err;
  }
  // Rate limits and hiccups: back off and retry a couple of times.
  if ((res.status === 429 || res.status >= 500) && attempt < 2) return retry(url, init, attempt);
  if (res.status < 200 || res.status >= 300) throw new Error(`${res.status} from ${new URL(url).host}`);
  try {
    return JSON.parse(res.text) as T;
  } catch {
    // Some hosts answer "Please try again later" with a 200 when throttling.
    if (attempt < 2) return retry(url, init, attempt);
    throw new Error(`Non-JSON response from ${new URL(url).host}`);
  }
}

async function retry<T>(url: string, init: HttpInit, attempt: number): Promise<T> {
  await new Promise((r) => setTimeout(r, 1500 * 3 ** attempt));
  return request<T>(url, init, attempt + 1);
}

const getJson = <T>(url: string) => request<T>(url);
const postJson = <T>(url: string, body: unknown) =>
  request<T>(url, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

/** Parses a date, or returns null so undated postings are skipped rather than treated as new. */
function date(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(typeof v === "number" && v < 1e12 ? v * 1000 : (v as string | number));
  return Number.isNaN(d.getTime()) ? null : d;
}

function dated<T extends { postedAt: Date | null }>(items: T[]) {
  return items.filter((p): p is T & { postedAt: Date } => p.postedAt !== null);
}

function workplaceOf(v?: string | null): Workplace {
  if (!v) return null;
  if (/remote/i.test(v)) return "REMOTE";
  if (/hybrid|flex/i.test(v)) return "HYBRID";
  if (/on-?site|office/i.test(v)) return "ONSITE";
  return null;
}

/** Searches below are already filtered to India, so make sure the location says so. */
const withIndia = (locations: (string | null | undefined)[]) => [
  ...locations.filter((l): l is string => Boolean(l)),
  "India",
];

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
  return dated(
    data.jobs.map((j) => ({
      externalId: String(j.id),
      title: j.title.trim(),
      locations: [j.location?.name ?? "", ...(j.offices ?? []).flatMap((o) => [o.name ?? "", o.location ?? ""])].filter(
        Boolean,
      ),
      workplace: null,
      department: j.departments?.[0]?.name ?? null,
      // Greenhouse double-encodes content: decode once to get HTML.
      description: htmlToText(decodeEntities(j.content ?? "")),
      applyUrl: j.absolute_url,
      postedAt: date(j.first_published ?? j.updated_at),
      pay: null,
    })),
  );
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
  return dated(
    data.map((j) => {
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
    }),
  );
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
  return dated(
    data.jobs
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
            ? {
                min: salary.minValue!,
                max: salary.maxValue!,
                currency: salary.currencyCode!,
                interval: salary.interval,
              }
            : null,
        };
      }),
  );
}

// ------------------------------------------------------------------ Workday
// The JSON API behind every *.myworkdayjobs.com careers site (public, no key).
// Token: "host|tenant|site", e.g. "nvidia.wd5.myworkdayjobs.com|nvidia|NVIDIAExternalCareerSite".

type WdFacetValue = {
  descriptor?: string;
  id: string;
  count?: number;
  facetParameter?: string;
  values?: WdFacetValue[];
};
type WdFacet = { facetParameter: string; values?: WdFacetValue[] };
type WdList = {
  total?: number;
  facets?: WdFacet[];
  jobPostings?: {
    title: string;
    externalPath: string;
    locationsText?: string;
    postedOn?: string;
    bulletFields?: string[];
  }[];
};
type WdDetail = {
  jobPostingInfo?: {
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    startDate?: string;
    externalUrl?: string;
    remoteType?: string;
  };
};

const INDIA_FACET_VALUE =
  /\bindia\b|\bIND\b|\bIN\s*-|bengaluru|bangalore|hyderabad|pune|gurugram|gurgaon|noida|mumbai|chennai|kolkata|ahmedabad|delhi|coimbatore|kochi|jaipur|vadodara|mohali|thiruvananthapuram/i;

/** Finds the facet filter that limits a Workday search to India: a country value, or else every Indian location. */
export function workdayIndiaFacet(facets: WdFacet[]): Record<string, string[]> | null {
  let country: [string, string] | null = null;
  const partial = new Map<string, string[]>();
  const walk = (list: (WdFacet | WdFacetValue)[]) => {
    for (const f of list) {
      const values = f.values ?? [];
      if (values[0]?.values) {
        walk(values);
        continue;
      }
      for (const v of values) {
        const label = v.descriptor?.trim() ?? "";
        if (/^india$/i.test(label)) country ??= [f.facetParameter!, v.id];
        else if (INDIA_FACET_VALUE.test(label))
          partial.set(f.facetParameter!, [...(partial.get(f.facetParameter!) ?? []), v.id]);
      }
    }
  };
  walk(facets);
  if (country) return { [country[0]]: [country[1]] };
  const best = [...partial.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  return best ? { [best[0]]: best[1] } : null;
}

/** "Posted Today" → 0, "Posted 3 Days Ago" → 3, "Posted 30+ Days Ago" → null (too old to list). */
export function workdayAgeDays(postedOn?: string): number | null {
  if (!postedOn) return null;
  if (/today/i.test(postedOn)) return 0;
  if (/yesterday/i.test(postedOn)) return 1;
  if (/\+/.test(postedOn)) return null;
  const n = /(\d+)\s+days?/i.exec(postedOn);
  return n ? Number(n[1]) : null;
}

async function workday(token: string, { since }: FetchOptions): Promise<RawPosting[]> {
  const [host, tenant, site] = token.split("|");
  if (!host || !tenant || !site) throw new Error(`Bad Workday token "${token}" (expected host|tenant|site)`);
  const api = `https://${host}/wday/cxs/${tenant}/${site}`;
  // myworkdaysite.com hosts put the tenant in the public URL path.
  const publicBase = host.includes("myworkdaysite.com")
    ? `https://${host}/recruiting/${tenant}/${site}`
    : `https://${host}/${site}`;

  const first = await postJson<WdList>(`${api}/jobs`, { appliedFacets: {}, limit: 20, offset: 0, searchText: "" });
  const facet = workdayIndiaFacet(first.facets ?? []);
  if (!facet) return [];

  const maxAge = Math.floor((Date.now() - since.getTime()) / 86_400_000);
  const out: RawPosting[] = [];
  const fetchPage = (offset: number) =>
    postJson<WdList>(`${api}/jobs`, { appliedFacets: facet, limit: 20, offset, searchText: "" });

  const firstPage = await fetchPage(0);
  const end = Math.min(firstPage.total ?? 0, 2000);
  let stalePages = collect(firstPage) === 0 ? 1 : 0;
  // Most sites sort newest first, but not all: keep paging (4 pages at a time)
  // until 3 pages in a row have nothing recent.
  for (let offset = 20; offset < end && stalePages < 3; offset += 80) {
    const offsets = [offset, offset + 20, offset + 40, offset + 60].filter((o) => o < end);
    for (const page of await Promise.all(offsets.map(fetchPage))) {
      if ((page.jobPostings ?? []).length === 0) {
        stalePages = 3;
        break;
      }
      stalePages = collect(page) === 0 ? stalePages + 1 : 0;
      if (stalePages >= 3) break;
    }
  }
  return out;

  /** Adds a page's recent postings to `out`; returns how many were recent. */
  function collect(page: WdList) {
    let fresh = 0;
    for (const p of page.jobPostings ?? []) {
      const age = workdayAgeDays(p.postedOn);
      if (age === null || age >= maxAge) continue;
      fresh++;
      const detailUrl = `${api}${p.externalPath}`;
      out.push({
        externalId: `${tenant}/${site}${p.externalPath}`,
        title: p.title.trim(),
        // "3 Locations" says nothing; the India facet already guarantees an Indian office.
        locations: withIndia([/^\d+ locations?$/i.test(p.locationsText ?? "") ? null : p.locationsText]),
        workplace: null,
        department: null,
        description: "",
        applyUrl: `${publicBase}${p.externalPath}`,
        postedAt: new Date(Date.now() - age * 86_400_000),
        pay: null,
        detail: async () => {
          const d = (await getJson<WdDetail>(detailUrl)).jobPostingInfo ?? {};
          return {
            description: htmlToText(d.jobDescription ?? ""),
            locations: withIndia([d.location, ...(d.additionalLocations ?? [])]),
            workplace: workplaceOf(d.remoteType),
            postedAt: date(d.startDate) ?? undefined,
            applyUrl: d.externalUrl || undefined,
          };
        },
      });
    }
    return fresh;
  }
}

// ------------------------------------------------------------------ SmartRecruiters
// https://developers.smartrecruiters.com/docs/posting-api (public, no key). Token: company identifier.

type SrList = {
  totalFound: number;
  content: {
    id: string;
    name: string;
    releasedDate: string;
    location?: { city?: string; region?: string; fullLocation?: string; remote?: boolean; hybrid?: boolean };
    department?: { label?: string };
    function?: { label?: string };
  }[];
};
type SrDetail = {
  postingUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
};

async function smartrecruiters(token: string, { since }: FetchOptions): Promise<RawPosting[]> {
  const api = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings`;
  const out: RawPosting[] = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const page = await getJson<SrList>(`${api}?country=in&limit=100&offset=${offset}`);
    for (const p of page.content) {
      const postedAt = date(p.releasedDate);
      if (!postedAt || postedAt < since) continue;
      out.push({
        externalId: p.id,
        title: p.name.trim(),
        locations: withIndia([p.location?.fullLocation, p.location?.city]),
        workplace: p.location?.remote ? "REMOTE" : p.location?.hybrid ? "HYBRID" : null,
        department: p.department?.label ?? p.function?.label ?? null,
        description: "",
        applyUrl: `https://jobs.smartrecruiters.com/${encodeURIComponent(token)}/${p.id}`,
        postedAt,
        pay: null,
        detail: async () => {
          const d = await getJson<SrDetail>(`${api}/${p.id}`);
          const sections = Object.values(d.jobAd?.sections ?? {});
          return {
            description: htmlToText(
              sections.map((s) => (s.title ? `<h3>${s.title}</h3>` : "") + (s.text ?? "")).join(""),
            ),
            applyUrl: d.postingUrl || undefined,
          };
        },
      });
    }
    if (offset + 100 >= page.totalFound) break;
  }
  return out;
}

// ------------------------------------------------------------------ Eightfold
// The search API behind Eightfold-hosted careers sites (Microsoft, Qualcomm, …).
// Token: "host|domain", e.g. "apply.careers.microsoft.com|microsoft.com".

type EfList = {
  data?: {
    count?: number;
    positions?: {
      id: number;
      name: string;
      locations?: string[];
      standardizedLocations?: string[];
      postedTs?: number;
      department?: string;
      workLocationOption?: string;
      positionUrl?: string;
    }[];
  };
};
type EfDetail = { data?: { jobDescription?: string; publicUrl?: string; workLocationOption?: string } };

async function eightfold(token: string, { since }: FetchOptions): Promise<RawPosting[]> {
  const [host, domain] = token.split("|");
  if (!host || !domain) throw new Error(`Bad Eightfold token "${token}" (expected host|domain)`);
  const base = `https://${host}/api/pcsx`;
  const out: RawPosting[] = [];
  for (let start = 0; start < 2000;) {
    const page = await getJson<EfList>(
      `${base}/search?domain=${domain}&query=&location=India&start=${start}&sort_by=timestamp`,
    );
    const positions = page.data?.positions ?? [];
    if (positions.length === 0) break;
    let fresh = 0;
    for (const p of positions) {
      const postedAt = date(p.postedTs);
      if (!postedAt || postedAt < since) continue;
      fresh++;
      out.push({
        externalId: `${domain}:${p.id}`,
        title: p.name.trim(),
        locations: withIndia([...(p.locations ?? []), ...(p.standardizedLocations ?? [])]),
        workplace: workplaceOf(p.workLocationOption),
        department: p.department ?? null,
        description: "",
        applyUrl: `https://${host}${p.positionUrl ?? `/careers/job/${p.id}`}`,
        postedAt,
        pay: null,
        detail: async () => {
          const d =
            (await getJson<EfDetail>(`${base}/position_details?position_id=${p.id}&domain=${domain}&hl=en`)).data ?? {};
          return { description: htmlToText(d.jobDescription ?? ""), applyUrl: d.publicUrl || undefined };
        },
      });
    }
    // Sorted newest first: a page with nothing recent means we're done.
    if (fresh === 0) break;
    start += positions.length;
    if (page.data?.count != null && start >= page.data.count) break;
  }
  return out;
}

// ------------------------------------------------------------------ Oracle Recruiting Cloud
// The REST API behind Oracle HCM careers sites (Oracle, JPMorgan Chase, …).
// Token: "host|siteNumber|indiaLocationId", e.g. "jpmc.fa.oraclecloud.com|CX_1001|300000000289360".

type OrList = {
  items?: {
    TotalJobsCount?: number;
    requisitionList?: {
      Id: string;
      Title: string;
      PostedDate?: string;
      PrimaryLocation?: string;
      WorkplaceType?: string;
      secondaryLocations?: { Name?: string }[];
    }[];
  }[];
};
type OrDetail = {
  items?: {
    ExternalDescriptionStr?: string;
    ExternalResponsibilitiesStr?: string;
    ExternalQualificationsStr?: string;
  }[];
};

async function oracle(token: string, { since }: FetchOptions): Promise<RawPosting[]> {
  const [host, siteNumber, locationId] = token.split("|");
  if (!host || !siteNumber || !locationId)
    throw new Error(`Bad Oracle token "${token}" (expected host|site|locationId)`);
  const api = `https://${host}/hcmRestApi/resources/latest`;
  const out: RawPosting[] = [];
  for (let offset = 0; offset < 2000; offset += 25) {
    const page = await getJson<OrList>(
      `${api}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${siteNumber},limit=25,offset=${offset},locationId=${locationId},sortBy=POSTING_DATES_DESC`,
    );
    const reqs = page.items?.[0]?.requisitionList ?? [];
    let fresh = 0;
    for (const r of reqs) {
      const postedAt = date(r.PostedDate);
      if (!postedAt || postedAt < since) continue;
      fresh++;
      out.push({
        externalId: `${host}:${r.Id}`,
        title: r.Title.trim(),
        locations: withIndia([r.PrimaryLocation, ...(r.secondaryLocations ?? []).map((s) => s.Name)]),
        workplace: workplaceOf(r.WorkplaceType),
        department: null,
        description: "",
        applyUrl: `https://${host}/hcmUI/CandidateExperience/en/sites/${siteNumber}/job/${r.Id}`,
        postedAt,
        pay: null,
        detail: async () => {
          const d = (
            await getJson<OrDetail>(
              `${api}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${r.Id}%22,siteNumber=${siteNumber}`,
            )
          ).items?.[0];
          const parts = [d?.ExternalDescriptionStr, d?.ExternalResponsibilitiesStr, d?.ExternalQualificationsStr];
          return { description: htmlToText(parts.filter(Boolean).join("")) };
        },
      });
    }
    if (reqs.length < 25 || fresh === 0) break;
  }
  return out;
}

// ------------------------------------------------------------------ Amazon
// The JSON behind amazon.jobs search (public, no key). Token: ISO-3 country code ("IND").

type AmazonJob = {
  id_icims: string;
  title: string;
  job_path: string;
  posted_date: string;
  normalized_location?: string;
  location?: string;
  city?: string;
  job_category?: string;
  description?: string;
  basic_qualifications?: string;
  preferred_qualifications?: string;
};

async function amazon(token: string, { since }: FetchOptions): Promise<RawPosting[]> {
  const out: RawPosting[] = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const page = await getJson<{ hits: number; jobs: AmazonJob[] }>(
      `https://www.amazon.jobs/en/search.json?country=${encodeURIComponent(token)}&result_limit=100&offset=${offset}&sort=recent`,
    );
    let fresh = 0;
    for (const j of page.jobs) {
      const postedAt = date(j.posted_date);
      if (!postedAt || postedAt < since) continue;
      fresh++;
      out.push({
        externalId: j.id_icims,
        title: j.title.trim(),
        locations: withIndia([j.normalized_location, j.city]),
        workplace: null,
        department: j.job_category ?? null,
        description: htmlToText(
          [
            j.description ?? "",
            j.basic_qualifications ? `<h3>Basic qualifications</h3>${j.basic_qualifications}` : "",
            j.preferred_qualifications ? `<h3>Preferred qualifications</h3>${j.preferred_qualifications}` : "",
          ].join(""),
        ),
        applyUrl: `https://www.amazon.jobs${j.job_path}`,
        postedAt,
        pay: null,
      });
    }
    if (page.jobs.length < 100 || offset + 100 >= page.hits || fresh === 0) break;
  }
  return out;
}

// ------------------------------------------------------------------ registry

export const FETCHERS: Record<SyncedSource, (token: string, opts: FetchOptions) => Promise<RawPosting[]>> = {
  GREENHOUSE: greenhouse,
  LEVER: lever,
  ASHBY: ashby,
  WORKDAY: workday,
  SMARTRECRUITERS: smartrecruiters,
  EIGHTFOLD: eightfold,
  ORACLE: oracle,
  AMAZON: amazon,
};
