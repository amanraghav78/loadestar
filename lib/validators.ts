import { z } from "zod";
import { Currency, Discipline, JobSource, Level, RemotePolicy } from "@/lib/generated/prisma/enums";
import { INDIA_CITIES } from "@/lib/ingest/classify";
import { splitTokens, TOKEN_HINT } from "@/lib/ingest/tokens";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Takes the first value when a query param is repeated (?q=a&q=b). */
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/** Anything unparseable is dropped rather than erroring — bad URLs should still render results. */
function lenient<T extends z.ZodType>(schema: T) {
  return z.preprocess(first, schema.optional().catch(undefined));
}

export const searchParamsSchema = z.object({
  q: lenient(optionalTrimmed(100)),
  location: lenient(optionalTrimmed(80)),
  remote: lenient(z.enum(RemotePolicy)),
  discipline: lenient(z.enum(Discipline)),
  level: lenient(z.enum(Level)),
  currency: lenient(z.enum(Currency)),
  minSalary: lenient(z.coerce.number().int().min(0).max(200_000_000)),
  tag: lenient(optionalTrimmed(40)),
  city: lenient(z.enum(INDIA_CITIES as [string, ...string[]])),
  /** "1" = only roles that publish a salary. */
  salary: lenient(z.literal("1")),
  cursor: lenient(z.string().regex(/^[a-z0-9]{10,40}$/i)),
});

export type JobSearchParams = z.infer<typeof searchParamsSchema>;

export function parseSearchParams(raw: Record<string, string | string[] | undefined>) {
  return searchParamsSchema.parse(raw);
}

/** Serialises filters back to a query string, skipping empty values. */
export function toQueryString(params: Partial<JobSearchParams>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

const httpsUrl = z
  .url({ protocol: /^https?$/ })
  .max(2000);

const optionalMoney = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().int().min(1).max(200_000_000).optional(),
);

const tagsField = z
  .string()
  .max(300)
  .transform((s) =>
    Array.from(
      new Set(
        s
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ).slice(0, 8),
  );

export const jobInputSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    companyId: z.string().min(1),
    description: z.string().trim().min(20).max(20_000),
    discipline: z.enum(Discipline),
    level: z.enum(Level),
    tags: tagsField,
    location: z.string().trim().min(2).max(80),
    remote: z.enum(RemotePolicy),
    remoteRegion: optionalTrimmed(40),
    // Optional: many Indian employers don't publish pay. Annual amounts (INR in rupees).
    salaryMin: optionalMoney,
    salaryMax: optionalMoney,
    currency: z.enum(Currency).default("INR"),
    applyUrl: httpsUrl,
    featured: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  })
  .refine((v) => (v.salaryMin == null) === (v.salaryMax == null), {
    path: ["salaryMax"],
    message: "Give both a minimum and a maximum, or leave both empty",
  })
  .refine((v) => v.salaryMin == null || v.salaryMax! >= v.salaryMin, {
    path: ["salaryMax"],
    message: "Maximum must be at least the minimum",
  });

export type JobInput = z.infer<typeof jobInputSchema>;

export const companyInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  website: httpsUrl,
  logoUrl: z.preprocess((v) => (v === "" ? undefined : v), httpsUrl.optional()),
  description: optionalTrimmed(2000),
  hq: optionalTrimmed(80),
  size: optionalTrimmed(40),
  atsSource: z.preprocess((v) => (v === "" ? undefined : v), z.enum(JobSource).exclude(["MANUAL"]).optional()),
  atsToken: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") || undefined : v),
    z.string().max(600).optional(),
  ),
  medianResponseDays: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(0).max(120).optional(),
  ),
  featured: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
}).superRefine((c, ctx) => {
  if (!c.atsSource) return;
  const hint = TOKEN_HINT[c.atsSource];
  // Several career sites of one company are separated by spaces.
  if (!c.atsToken || !splitTokens(c.atsToken).every((t) => hint.pattern.test(t))) {
    ctx.addIssue({ code: "custom", path: ["atsToken"], message: `${hint.label} token looks like ${hint.example}` });
  }
});

export type CompanyInput = z.infer<typeof companyInputSchema>;

export const idsParamSchema = z
  .string()
  .max(2000)
  .transform((s) => s.split(",").filter((id) => /^[a-z0-9]{10,40}$/i.test(id)))
  .pipe(z.array(z.string()).max(100));
