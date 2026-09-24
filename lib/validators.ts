import { z } from "zod";
import {
  ApplicationStage,
  Currency,
  Discipline,
  EducationLevel,
  EmploymentType,
  Industry,
  JobSource,
  Level,
  RemotePolicy,
} from "@/lib/generated/prisma/enums";
import { INDIA_CITIES } from "@/lib/ingest/classify";
import { splitTokens, TOKEN_HINT } from "@/lib/ingest/tokens";
import { parseInrAmount } from "@/lib/resume-parse";

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
  employmentType: lenient(z.enum(EmploymentType)),
  /** Sector, matched against the hiring company. */
  industry: lenient(z.enum(Industry)),
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

const httpsUrl = z.url({ protocol: /^https?$/ }).max(2000);

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

/**
 * The fields of a listing, before the cross-field checks. Kept separate so the
 * recruiter form can drop the ones that aren't theirs to set (`featured`) and
 * still share every rule; `jobInputSchema` is what the admin form posts.
 */
const jobFieldsSchema = z.object({
  title: z.string().trim().min(3).max(120),
  companyId: z.string().min(1),
  description: z.string().trim().min(20).max(20_000),
  discipline: z.enum(Discipline),
  level: z.enum(Level),
  employmentType: z.enum(EmploymentType).default("FULL_TIME"),
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
});

/** A band is either published in full or not at all, and must run upwards. */
function checkSalaryBand<T extends z.ZodType<{ salaryMin?: number; salaryMax?: number }>>(schema: T) {
  return schema
    .refine((v) => (v.salaryMin == null) === (v.salaryMax == null), {
      path: ["salaryMax"],
      message: "Give both a minimum and a maximum, or leave both empty",
    })
    .refine((v) => v.salaryMin == null || v.salaryMax! >= v.salaryMin, {
      path: ["salaryMax"],
      message: "Maximum must be at least the minimum",
    });
}

export const jobInputSchema = checkSalaryBand(jobFieldsSchema);

export type JobInput = z.infer<typeof jobInputSchema>;

export const companyInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    website: httpsUrl,
    logoUrl: z.preprocess((v) => (v === "" ? undefined : v), httpsUrl.optional()),
    description: optionalTrimmed(2000),
    hq: optionalTrimmed(80),
    size: optionalTrimmed(40),
    industry: z.preprocess((v) => (v === "" ? undefined : v), z.enum(Industry).optional()),
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
  })
  .superRefine((c, ctx) => {
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

// ---------------------------------------------------------------- candidates

/** A profile URL on the expected site, so a typo'd link is caught while typing it. */
const profileUrl = (host: RegExp, example: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    httpsUrl.refine((url) => host.test(new URL(url).hostname), `Enter a ${example} address`).optional(),
  );

/**
 * Pay typed the way Indians quote it — "18", "18 LPA", "₹18,00,000" all mean
 * the same thing — normalised to rupees per year by the resume parser's reader.
 */
const annualPay = (message: string) =>
  z.preprocess((v) => {
    if (typeof v !== "string" || v.trim() === "") return undefined;
    // null (unparseable) becomes the string again so zod reports the message
    // rather than silently dropping what they typed.
    return parseInrAmount(v) ?? v.trim();
  }, z.number().int().min(1000, message).max(200_000_000, message).optional());

/** Free-typed, comma-separated, and deduplicated case-insensitively. */
const skillsField = z.preprocess(
  (v) => (typeof v === "string" ? v : ""),
  z
    .string()
    .max(1200)
    .transform((s) => {
      const seen = new Map<string, string>();
      for (const part of s.split(",")) {
        const skill = part.trim().slice(0, 40);
        if (skill && !seen.has(skill.toLowerCase())) seen.set(skill.toLowerCase(), skill);
      }
      return [...seen.values()].slice(0, 40);
    }),
);

/**
 * Everything a candidate tells us about themselves is optional except their
 * name: a half-filled profile is more useful than an abandoned form.
 */
export const profileInputSchema = z.object({
  fullName: z.string().trim().min(1, "Tell us your name").max(80),
  // Indian mobile numbers, with or without +91, and international formats.
  phone: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/[\s\-()]/g, "") : v),
    z
      .string()
      .regex(/^\+?[0-9]{7,15}$/, "Enter a phone number like +91 98765 43210")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  ),
  city: optionalTrimmed(60),
  yearsExperience: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(0, "Years can't be negative").max(60, "That looks too high").optional(),
  ),
  currentTitle: optionalTrimmed(80),
  educationLevel: z.preprocess((v) => (v === "" ? undefined : v), z.enum(EducationLevel).optional()),
  degree: optionalTrimmed(80),
  institution: optionalTrimmed(120),
  // A year they could plausibly have finished in, or expect to.
  graduationYear: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce
      .number()
      .int()
      .min(1950, "Enter a year like 2021")
      .max(new Date().getFullYear() + 8, "That year is too far ahead")
      .optional(),
  ),
  linkedinUrl: profileUrl(/(^|\.)linkedin\.com$/i, "linkedin.com"),
  githubUrl: profileUrl(/(^|\.)github\.com$/i, "github.com"),
  portfolioUrl: z.preprocess((v) => (v === "" || v == null ? undefined : v), httpsUrl.optional()),
  currentSalary: annualPay("Enter your pay like 18 LPA or 1800000"),
  expectedSalary: annualPay("Enter the pay you want, like 25 LPA"),
  noticePeriod: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(0).max(180, "Pick a notice period of six months or less").optional(),
  ),
  skills: skillsField,
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

/** The candidate's own stage for an application, plus their private note. */
export const applicationStageSchema = z.object({
  jobId: z.string().regex(/^[a-z0-9]{10,40}$/i),
  stage: z.enum(ApplicationStage),
  note: optionalTrimmed(500),
});

// ---------------------------------------------------------------- recruiters

/**
 * A recruiter's claim on a company. The work address must be at a real domain;
 * whether it is *their* company's domain is what the admin checks.
 */
export const companyClaimSchema = z.object({
  companyId: z.string().min(1, "Choose your company"),
  workEmail: z
    .string()
    .trim()
    .max(160)
    .pipe(z.email("Enter your work email address"))
    // Runs even when the address above failed to parse, so the domain is read
    // defensively rather than assumed to exist.
    .refine((email) => {
      const domain = email?.split("@")[1]?.toLowerCase();
      return !domain || !FREE_EMAIL_DOMAINS.has(domain);
    }, "Use your work address, not a personal one"),
  note: optionalTrimmed(500),
});

export type CompanyClaimInput = z.infer<typeof companyClaimSchema>;

/** Personal-email providers, which prove nothing about where someone works. */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.in",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "rediffmail.com",
  "zoho.com",
  "aol.com",
  "mail.com",
  "yandex.com",
]);

/**
 * What a recruiter fills in to post a role. Deliberately not `jobInputSchema`:
 * a recruiter picks neither the company (it comes from their approved claim)
 * nor `featured` (that is ours to grant).
 */
export const recruiterJobSchema = checkSalaryBand(jobFieldsSchema.omit({ featured: true })).refine(
  (v) => v.salaryMin != null && v.salaryMax != null,
  {
    path: ["salaryMin"],
    // The one rule the whole board rests on, so it is enforced here and not
    // only in the form: an employer-submitted listing publishes its band.
    message: "Publish the band — a role without one doesn't go live",
  },
);

export type RecruiterJobInput = z.infer<typeof recruiterJobSchema>;

// ---------------------------------------------------------------- reviews

export const reviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1, "Give a rating").max(5),
  title: z.string().trim().min(6, "Sum it up in a few words").max(120),
  pros: z.string().trim().min(20, "Say a little more — at least 20 characters").max(2000),
  cons: z.string().trim().min(20, "Say a little more — at least 20 characters").max(2000),
  roleTitle: optionalTrimmed(80),
  stillThere: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

/** An admin's decision on a queued item, with a reason when it is a refusal. */
export const moderationDecisionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]{10,40}$/i),
    decision: z.enum(["APPROVED", "REJECTED"]),
    reviewNote: optionalTrimmed(500),
  })
  .refine((v) => v.decision === "APPROVED" || Boolean(v.reviewNote), {
    path: ["reviewNote"],
    message: "Say why, so they can fix it",
  });

// ---------------------------------------------------------------- resume builder

/**
 * The resume a candidate writes on Lodestar (lib/resume-builder.ts).
 *
 * It arrives as one JSON field rather than a flat form: the sections are lists
 * the candidate adds to and reorders, and `ResumeDocument` stores them as JSON.
 * Every string is bounded, because this is the one place where what somebody
 * typed is rendered straight into a file we hand back to them.
 */
const resumeLine = (max: number) => z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().trim().max(max));

const resumeBullets = z.preprocess(
  (v) => (Array.isArray(v) ? v : []),
  z
    .array(z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().trim().max(400)))
    .max(12)
    .transform((list) => list.filter(Boolean)),
);

const resumeSection = <T extends z.ZodType>(entry: T, max: number) =>
  z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(entry).max(max));

const resumeExperienceSchema = z.object({
  role: resumeLine(100),
  company: resumeLine(100),
  location: resumeLine(60),
  // Free text: a month input gives "2021-03", and someone typing it themselves
  // may well write "Summer 2021". `formatResumeDate` reads both.
  start: resumeLine(24),
  end: resumeLine(24),
  current: z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean()),
  bullets: resumeBullets,
});

const resumeEducationSchema = z.object({
  degree: resumeLine(100),
  institution: resumeLine(120),
  location: resumeLine(60),
  start: resumeLine(24),
  end: resumeLine(24),
  detail: resumeLine(120),
});

const resumeProjectSchema = z.object({
  name: resumeLine(100),
  link: resumeLine(300),
  bullets: resumeBullets,
});

const resumeCertificationSchema = z.object({
  name: resumeLine(120),
  issuer: resumeLine(100),
  year: resumeLine(24),
});

/** Deduplicated case-insensitively, like the profile's skills, and in the order given. */
const resumeSkills = z.preprocess(
  (v) => (Array.isArray(v) ? v : []),
  z.array(z.unknown()).transform((list) => {
    const seen = new Map<string, string>();
    for (const value of list) {
      const skill = typeof value === "string" ? value.trim().slice(0, 40) : "";
      if (skill && !seen.has(skill.toLowerCase())) seen.set(skill.toLowerCase(), skill);
    }
    return [...seen.values()].slice(0, 40);
  }),
);

export const resumeContentSchema = z.object({
  headline: resumeLine(120),
  summary: resumeLine(1500),
  skills: resumeSkills,
  experience: resumeSection(resumeExperienceSchema, 15),
  projects: resumeSection(resumeProjectSchema, 10),
  education: resumeSection(resumeEducationSchema, 8),
  certifications: resumeSection(resumeCertificationSchema, 12),
});

export type ResumeContentInput = z.infer<typeof resumeContentSchema>;

/**
 * Reads a stored document back. The columns are JSON, so a row written by an
 * older version of this schema — or by hand — has to degrade to an empty
 * section rather than break the page the candidate came to fix it on.
 */
export function parseResumeContent(raw: unknown): ResumeContentInput {
  const parsed = resumeContentSchema.safeParse(raw);
  return parsed.success
    ? parsed.data
    : { headline: "", summary: "", skills: [], experience: [], projects: [], education: [], certifications: [] };
}
