import { extractTags, matchIndiaCity } from "@/lib/ingest/classify";

/**
 * Reads a resume's plain text into profile fields worth *suggesting*.
 *
 * Pure and dependency-free, so it is unit-testable against real resume shapes
 * without a PDF, a database or a network. Extracting the text is a separate
 * concern (lib/resume-text.ts).
 *
 * Everything here is a guess. Nothing it returns is saved without the candidate
 * seeing it in the form first, and whatever they do save goes through
 * `profileInputSchema` like any other typed input — so a wrong guess is an
 * annoyance, never a validation hole.
 */

/** Resumes are two pages. Anything past this is a book, and not worth scanning. */
const MAX_TEXT = 120_000;

export type ResumeSuggestions = {
  fullName?: string;
  phone?: string;
  city?: string;
  currentTitle?: string;
  yearsExperience?: number;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  currentSalary?: number;
  expectedSalary?: number;
  noticePeriod?: number;
  skills: string[];
};

export function parseResumeText(raw: string, now: Date = new Date()): ResumeSuggestions {
  // Normalise the line endings and the non-breaking spaces PDFs are full of,
  // but keep the line breaks: the layout is most of what we have to go on.
  const text = raw
    .slice(0, MAX_TEXT)
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/[‐-―]/g, "-")
    .replace(/[ \t]+/g, " ");
  const lines = text.split("\n").map((l) => l.trim());

  const suggestions: ResumeSuggestions = {
    fullName: findName(lines),
    phone: findPhone(text),
    city: matchIndiaCity(text) ?? undefined,
    currentTitle: findTitle(lines),
    yearsExperience: findYearsExperience(text, now),
    ...findLinks(text),
    ...findCompensation(text),
    noticePeriod: findNoticePeriod(text),
    // The same vocabulary the job feeds are tagged with, which is what makes
    // the two directly comparable in lib/recommendations.ts.
    skills: extractTags("", text, 20),
  };

  // Drop the keys we found nothing for, so callers can spread this over a
  // profile without blanking fields the candidate already filled in.
  for (const key of Object.keys(suggestions) as Array<keyof ResumeSuggestions>) {
    if (suggestions[key] === undefined) delete suggestions[key];
  }
  return suggestions;
}

/** How many fields we actually filled — what the UI reports back to the candidate. */
export function countSuggestions(s: ResumeSuggestions): number {
  return Object.entries(s).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== undefined)).length;
}

// ------------------------------------------------------------------ name

/** Words that mark a line as a heading or a contact line rather than a name. */
const NOT_A_NAME =
  /\b(resume|curriculum|vitae|profile|summary|objective|contact|address|phone|email|mobile|linkedin|github|experience|education|skills|projects|portfolio|engineer|developer|manager|designer|analyst|scientist|architect|consultant|intern)\b/i;

/**
 * The candidate's name is almost always the first substantial line of a resume,
 * set large and above the contact details. We take the first line in the top of
 * the document that reads like a person's name and nothing else.
 */
function findName(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 12)) {
    if (line.length < 3 || line.length > 60) continue;
    // A name has no digits, no punctuation that belongs to contact details, and
    // isn't a section heading or a job title.
    if (/[\d@|/\\:•·,()]/.test(line) || NOT_A_NAME.test(line)) continue;

    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    // Every word starts with a capital: "Aman Raghav" or "AMAN RAGHAV".
    if (!words.every((w) => /^[A-Z][a-zA-Z'.-]*$/.test(w))) continue;

    return toTitleCase(line).slice(0, 80);
  }
  return undefined;
}

/** "AMAN RAGHAV" → "Aman Raghav", but "McDonald" and "Aman" are left alone. */
function toTitleCase(name: string): string {
  if (!/^[A-Z' .-]+$/.test(name)) return name;
  return name.toLowerCase().replace(/(^|[\s'.-])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

// ------------------------------------------------------------------ phone

/**
 * An Indian mobile (10 digits starting 6-9, with or without +91) or a general
 * international number. Deliberately strict about length so a year range, a PIN
 * code or an employee id can't be read as a phone number.
 */
function findPhone(text: string): string | undefined {
  const india = /(?:\+?91[\s-]?)?\b([6-9]\d{4})[\s-]?(\d{5})\b/.exec(text);
  if (india) {
    const local = `${india[1]}${india[2]}`;
    return /\+?91/.test(india[0]) ? `+91${local}` : local;
  }
  // Anything else has to announce itself with a country code.
  const international = /\+(\d[\d\s-]{7,16}\d)/.exec(text);
  if (international) {
    const digits = international[1]!.replace(/[\s-]/g, "");
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  }
  return undefined;
}

// ------------------------------------------------------------------ links

function findLinks(text: string): Pick<ResumeSuggestions, "linkedinUrl" | "githubUrl" | "portfolioUrl"> {
  // Email addresses go first: "aman.raghav@gmail.com" contains "aman.raghav",
  // which is shaped exactly like a personal domain.
  const withoutEmails = text.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, " ");
  const urls = withoutEmails.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s)<>"']*)?/gi) ?? [];

  let linkedinUrl: string | undefined;
  let githubUrl: string | undefined;
  let portfolioUrl: string | undefined;

  for (const raw of urls) {
    // PDFs love to leave a trailing full stop or bracket on a link.
    const cleaned = raw.replace(/[.,;:)\]}]+$/, "");
    const url = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    let host: string;
    let pathname: string;
    try {
      const parsed = new URL(url);
      host = parsed.hostname.toLowerCase();
      pathname = parsed.pathname;
    } catch {
      continue;
    }
    if (url.length > 2000) continue;

    // A bare "linkedin.com" with no profile path is the header of a contact
    // block, not a link to anywhere.
    if (/(^|\.)linkedin\.com$/.test(host)) {
      if (!linkedinUrl && pathname.length > 1) linkedinUrl = url;
    } else if (/(^|\.)github\.com$/.test(host)) {
      if (!githubUrl && pathname.length > 1) githubUrl = url;
    } else if (!portfolioUrl && !IGNORED_HOST.test(host)) {
      portfolioUrl = url;
    }
  }
  return { linkedinUrl, githubUrl, portfolioUrl };
}

/** Hosts that appear on a resume without being the candidate's own site. */
const IGNORED_HOST =
  /(^|\.)(gmail\.com|googlemail\.com|yahoo\.[a-z.]+|outlook\.com|hotmail\.com|protonmail\.com|icloud\.com|example\.com|w3\.org|adobe\.com)$/;

// ------------------------------------------------------------------ title

const TITLE_LINE =
  /^[A-Za-z][A-Za-z0-9+/&.,'-]*(?:\s+[A-Za-z0-9+/&.,'()-]+){0,5}\s*(engineer|developer|programmer|architect|designer|manager|analyst|scientist|consultant|administrator|specialist|lead|intern)\b/i;

/**
 * The headline under the candidate's name ("Senior Backend Engineer"), which is
 * what people mean by their current title far more reliably than the first
 * entry in their work history.
 */
function findTitle(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 14)) {
    if (line.length < 4 || line.length > 80) continue;
    if (/[@|]/.test(line) || /\b(experience|education|skills|projects|summary)\b/i.test(line)) continue;
    if (!TITLE_LINE.test(line)) continue;
    // "Software Engineer at Acme" — keep the role, drop the employer.
    return line.split(/\s+(?:at|@|-|·|\|)\s+/)[0]!.trim().slice(0, 80);
  }
  return undefined;
}

// ------------------------------------------------------------------ experience

/** Where a work-history section starts, and where the next section ends it. */
const EXPERIENCE_HEADING = /^\s*(work\s+|professional\s+|employment\s+)?(experience|history|employment)\s*:?\s*$/im;
const NEXT_HEADING = /^\s*(education|academic|skills|technical skills|projects|certifications|awards|publications|interests|languages)\s*:?\s*$/im;

function findYearsExperience(text: string, now: Date): number | undefined {
  // What the candidate says outright always wins over anything we infer.
  const stated =
    /\b(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\b(?:\s*(?:of|-))?\s*(?:[a-z ]{0,24}\s)?experience/i.exec(text) ??
    /experience\s*[:-]\s*(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)/i.exec(text);
  if (stated) {
    const years = Math.round(Number(stated[1]));
    if (Number.isFinite(years) && years >= 0 && years <= 60) return years;
  }

  // Otherwise, the earliest year in the work-history section. Education years
  // are excluded on purpose: counting a degree start date as experience
  // overstates everyone by three or four years.
  const start = EXPERIENCE_HEADING.exec(text);
  if (!start) return undefined;
  const after = text.slice(start.index + start[0].length);
  const end = NEXT_HEADING.exec(after);
  const section = end ? after.slice(0, end.index) : after;

  const thisYear = now.getFullYear();
  const years = (section.match(/\b(19[89]\d|20[0-4]\d)\b/g) ?? [])
    .map(Number)
    .filter((y) => y >= 1980 && y <= thisYear);
  if (years.length === 0) return undefined;

  const earliest = Math.min(...years);
  const inferred = thisYear - earliest;
  return inferred >= 0 && inferred <= 60 ? inferred : undefined;
}

// ------------------------------------------------------------------ money

const LAKH = 100_000;
const CRORE = 10_000_000;

/**
 * "18 LPA", "₹18,00,000", "24.5 lakhs", "1.2 Cr" → rupees per year.
 *
 * A bare number under 200 is read as lakhs, because that is how pay is quoted
 * in India ("Current CTC: 22") and nobody earns ₹22 a year. Returns null rather
 * than guessing when the figure is outside what a salary can be.
 */
export function parseInrAmount(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]|(?:\bINR\b)|(?:\bRs\.?)/gi, "");
  const match = /^(\d+(?:\.\d+)?)(lpa|lakhs?|lacs?|l|cr|crores?|k)?$/i.exec(cleaned);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2]?.toLowerCase();
  const amount =
    unit === "cr" || unit === "crore" || unit === "crores"
      ? value * CRORE
      : unit === "k"
        ? value * 1000
        : unit
          ? value * LAKH
          : value < 200
            ? value * LAKH
            : value;

  const rounded = Math.round(amount);
  return rounded >= 1000 && rounded <= 200_000_000 ? rounded : null;
}

const AMOUNT = String.raw`((?:₹|INR|Rs\.?)?\s*\d[\d,.]*\s*(?:LPA|lakhs?|lacs?|crores?|Cr|L|K)?)`;

function findCompensation(text: string): Pick<ResumeSuggestions, "currentSalary" | "expectedSalary"> {
  const current = new RegExp(String.raw`\b(?:current|present|existing)\s*(?:ctc|salary|compensation|package)\s*[:\-–]?\s*${AMOUNT}`, "i").exec(text);
  const expected = new RegExp(String.raw`\b(?:expected|desired|expecting)\s*(?:ctc|salary|compensation|package)\s*[:\-–]?\s*${AMOUNT}`, "i").exec(text);
  // A lone "CTC: 18 LPA" with no qualifier means what they earn now.
  const bare = new RegExp(String.raw`\bctc\s*[:\-–]\s*${AMOUNT}`, "i").exec(text);

  return {
    currentSalary: parseInrAmount(current?.[1] ?? bare?.[1] ?? "") ?? undefined,
    expectedSalary: parseInrAmount(expected?.[1] ?? "") ?? undefined,
  };
}

// ------------------------------------------------------------------ notice

/** Longest notice an Indian employer serves; anything above is a misread. */
const MAX_NOTICE_DAYS = 180;

function findNoticePeriod(text: string): number | undefined {
  if (/\b(?:notice\s*period\s*[:\-–]?\s*)?(?:immediate(?:ly)?\s*(?:joiner|available|joining)|available\s*immediately|serving\s*notice\s*period\s*[:\-–]?\s*immediate)\b/i.test(text)) {
    return 0;
  }

  const match = /\bnotice\s*period\s*[:\-–]?\s*(?:of\s*)?(\d{1,3})\s*(day|week|month)s?\b/i.exec(text);
  if (!match) {
    // "Notice period: Immediate"
    return /\bnotice\s*period\s*[:\-–]?\s*immediate/i.test(text) ? 0 : undefined;
  }

  const value = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const days = unit === "month" ? value * 30 : unit === "week" ? value * 7 : value;
  return days >= 0 && days <= MAX_NOTICE_DAYS ? days : undefined;
}
