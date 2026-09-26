import type { EducationLevel } from "@/lib/generated/prisma/enums";
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

/** Well under the 40 the database allows, so the candidate has room to add their own. */
const MAX_SKILLS = 30;

export type ResumeSuggestions = {
  fullName?: string;
  phone?: string;
  city?: string;
  currentTitle?: string;
  yearsExperience?: number;
  educationLevel?: EducationLevel;
  degree?: string;
  institution?: string;
  graduationYear?: number;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  currentSalary?: number;
  expectedSalary?: number;
  noticePeriod?: number;
  skills: string[];
};

/**
 * The highest qualification named in the resume, the course it was in, where it
 * was taken and when it finished.
 *
 * Resumes write education a dozen ways, so this stays deliberately literal: the
 * degree has to be one we recognise by name, and the institution has to sit on
 * the same line or the one after it. A guess nobody can explain is worse than
 * leaving the field blank for the candidate to fill in themselves.
 */
export function findEducation(
  lines: string[],
  now: Date = new Date(),
): Pick<ResumeSuggestions, "educationLevel" | "degree" | "institution" | "graduationYear"> {
  const out: Pick<ResumeSuggestions, "educationLevel" | "degree" | "institution" | "graduationYear"> = {};
  let bestRank = -1;

  lines.forEach((line, i) => {
    if (!line || line.length > 200) return;
    const found = DEGREES.find(([re]) => re.test(line));
    if (!found) return;
    const [, level, rank] = found;
    // Keep the highest qualification, not the first one listed.
    if (rank <= bestRank) return;

    bestRank = rank;
    const next = lines[i + 1] ?? "";
    out.educationLevel = level;
    out.degree = tidyDegree(line);
    out.institution = findInstitution(line) ?? findInstitution(next) ?? undefined;
    out.graduationYear = findGraduationYear(line, next, now);
  });

  // Same contract as the rest of the parser: a key we found nothing for is absent.
  if (!out.degree) delete out.degree;
  if (!out.institution) delete out.institution;
  if (out.graduationYear === undefined) delete out.graduationYear;
  return out;
}

/**
 * Degrees we recognise, lowest first. `rank` orders them, so a resume listing
 * both a B.Tech and an M.Tech reports the master's.
 */
const DEGREES: Array<[RegExp, EducationLevel, number]> = [
  [/\b(class 12|class xii|12th|higher secondary|senior secondary|hsc|puc|intermediate|cbse|icse)\b/i, "HIGH_SCHOOL", 0],
  [/\b(diploma|polytechnic)\b/i, "DIPLOMA", 1],
  [/\b(b\.?\s?tech|b\.?\s?e\b|bachelor(?:'s)?|b\.?\s?sc|b\.?\s?c\.?a|b\.?\s?com|b\.?\s?a\b|bs\b)/i, "BACHELORS", 2],
  [/\b(m\.?\s?tech|m\.?\s?e\b|master(?:'s)?|m\.?\s?sc|m\.?\s?c\.?a|m\.?\s?com|mba|pgdm|ms\b)/i, "MASTERS", 3],
  [/\b(ph\.?\s?d|doctorate|doctoral)\b/i, "DOCTORATE", 4],
];

/** Whether this line names a qualification we recognise (a degree, a diploma, class 12). */
export const namesDegree = (line: string) => line.length <= 200 && DEGREES.some(([re]) => re.test(line));

/**
 * One qualification, read from its own line and the one after it: the course,
 * the institution, the years and the result (CGPA or percentage), which is
 * what an Indian resume's education section carries for each entry.
 */
export function readEducationLine(line: string, next = "", now: Date = new Date()) {
  const both = `${line} ${next}`;
  const max = now.getFullYear() + 8;
  const years = [...both.matchAll(/\b(19[5-9]\d|20\d\d)\b/g)].map((m) => Number(m[1])).filter((y) => y <= max);
  const score =
    /\b(?:cgpa|gpa|cpi|sgpa)\s*[:\-–]?\s*(\d{1,2}(?:\.\d{1,2})?)(\s*\/\s*10)?/i.exec(both) ??
    /\b(\d{2}(?:\.\d{1,2})?)\s*%/.exec(both);
  const detail = score ? (/%/.test(score[0]) ? `${score[1]}%` : `CGPA ${score[1]}${score[2] ? "/10" : ""}`) : "";
  const institution = findInstitution(line) ?? findInstitution(next) ?? "";
  // The course in full ("B.Tech, Computer Science"), not just the degree's
  // name: on a resume the branch matters as much as the letters.
  const degree = line
    .replace(institution, " ")
    .replace(/\b(?:cgpa|gpa|cpi|sgpa|percentage|marks)\b.*$/i, " ")
    .replace(/\b\d{2}(?:\.\d{1,2})?\s*%.*$/, " ")
    .replace(/\(?\b(19|20)\d{2}\b\s*(?:-|to|–)?\s*(?:(?:19|20)\d{2}|present)?\)?/gi, " ")
    .replace(/^(education|academic details|qualification)\s*:?\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/(?:\s*[,|•·:;\-–]\s*)+$/g, "")
    .replace(/^(?:\s*[,|•·:;\-–]\s*)+/g, "")
    .replace(/\s+,/g, ",")
    .replace(/\s+(?:from|at)$/i, "")
    .trim();
  return {
    degree: degree.slice(0, 100),
    institution: institution.slice(0, 120),
    start: years.length > 1 ? String(Math.min(...years)) : "",
    end: years.length > 0 ? String(Math.max(...years)) : "",
    detail,
  };
}

/** Phrases that mark a line as naming a place of study rather than a course. */
const INSTITUTION =
  /\b(?:indian institute of [a-z ]+|iiit[a-z ]*|iit[a-z ]*|nit [a-z ]+|bits [a-z ]+|[a-z.& ]{2,40}(?:university|college|institute of technology)|university of [a-z ]+)\b/i;

function findInstitution(line: string) {
  const m = INSTITUTION.exec(line);
  if (!m) return null;
  const name = m[0].replace(/\s+/g, " ").trim();
  return name.length >= 4 && name.length <= 120 ? name : null;
}

/** The course as written, with the institution, dates and marks stripped off. */
function tidyDegree(line: string) {
  const degree = line
    .split(/[|•]|,\s*(?=[A-Z])/)[0]!
    .replace(/\b(19|20)\d{2}\b\s*(?:-|to|–)?\s*(?:(?:19|20)\d{2}|present)?/gi, "")
    .replace(/\b(cgpa|gpa|percentage|marks)\b.*/i, "")
    .replace(/^(education|academic details|qualification)\s*:?\s*/i, "")
    .replace(/[\s:;.\-–]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return degree.length >= 2 && degree.length <= 80 ? degree : undefined;
}

/** The later year around the degree line, which is when the course ended. */
function findGraduationYear(line: string, next: string, now: Date) {
  const max = now.getFullYear() + 8;
  const years = [...`${line} ${next}`.matchAll(/\b(19[5-9]\d|20\d\d)\b/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y >= 1950 && y <= max);
  return years.length > 0 ? Math.max(...years) : undefined;
}

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
    ...findEducation(lines, now),
    ...findLinks(text, lines),
    ...findCompensation(text),
    noticePeriod: findNoticePeriod(text),
    // The same vocabulary the job feeds are tagged with, which is what makes
    // the two directly comparable in lib/recommendations.ts. A resume lists far
    // more than a job ad does, so it takes a much higher cap than a job card.
    skills: extractTags("", text, MAX_SKILLS),
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

/**
 * How far down the page the contact block reaches. A personal site is written
 * next to the phone number and the LinkedIn link, at the top. A domain further
 * down is an employer, a client or a certificate issuer — never the candidate's
 * own site, and offering one of those as their portfolio is worse than offering
 * nothing.
 */
const HEADER_LINES = 12;

/** A heading means the contact block is over and the résumé proper has started. */
const SECTION_HEADING =
  /^\s*(summary|objective|profile|about|experience|work experience|professional experience|employment|education|skills|technical skills|projects|certifications|achievements|awards|publications)\s*:?\s*$/i;

/** The lines above the first section heading: name, location, phone, links. */
function contactBlock(lines: string[]): string {
  const header = lines.slice(0, HEADER_LINES);
  const firstHeading = header.findIndex((line) => SECTION_HEADING.test(line));
  return (firstHeading === -1 ? header : header.slice(0, firstHeading)).join("\n");
}

function findLinks(
  text: string,
  lines: string[],
): Pick<ResumeSuggestions, "linkedinUrl" | "githubUrl" | "portfolioUrl"> {
  let linkedinUrl: string | undefined;
  let githubUrl: string | undefined;

  // Profile links are worth finding wherever they are: plenty of resumes keep
  // them in a "Links" section at the bottom.
  for (const { host, pathname, url } of urlsIn(text)) {
    // A bare "linkedin.com" with no profile path is the label of a contact
    // block, not a link to anywhere.
    if (/(^|\.)linkedin\.com$/.test(host)) {
      if (!linkedinUrl && pathname.length > 1) linkedinUrl = url;
    } else if (/(^|\.)github\.com$/.test(host)) {
      if (!githubUrl && pathname.length > 1) githubUrl = url;
    }
  }

  const portfolio = urlsIn(contactBlock(lines)).find(({ host }) => !KNOWN_HOST.test(host) && !NOT_A_DOMAIN.has(host));

  return { linkedinUrl, githubUrl, portfolioUrl: portfolio?.url };
}

type FoundUrl = { url: string; host: string; pathname: string };

function urlsIn(text: string): FoundUrl[] {
  // Email addresses go first: "aman.raghav@gmail.com" contains "aman.raghav",
  // which is shaped exactly like a personal domain.
  const withoutEmails = text.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, " ");
  const matches =
    withoutEmails.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s)<>"']*)?/gi) ?? [];

  const found: FoundUrl[] = [];
  for (const raw of matches) {
    // PDFs love to leave a trailing full stop or bracket on a link.
    const cleaned = raw.replace(/[.,;:)\]}]+$/, "");
    const url = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    if (url.length > 2000) continue;

    let host: string;
    let pathname: string;
    try {
      const parsed = new URL(url);
      host = parsed.hostname.toLowerCase();
      pathname = parsed.pathname;
    } catch {
      continue;
    }

    // "Node.js" and "React.js" are shaped exactly like domains. Requiring a
    // real suffix is what separates a link from a library.
    const tld = host.slice(host.lastIndexOf(".") + 1);
    if (!TLDS.has(tld)) continue;

    found.push({ url, host, pathname });
  }
  return found;
}

/**
 * Suffixes we accept as real. Not the full IANA list — just enough that a
 * candidate's own site is recognised and a filename or a library name is not.
 */
const TLDS = new Set(
  (
    "com net org io dev me co in app ai edu gov info xyz tech site online store studio design digital agency " +
    "solutions works live life world today news blog wiki link one pro name biz tv cc gg sh to ly is am fm " +
    "cloud page space us uk ca de fr au nl se no fi dk es it ch jp cn br mx ru pl pt gr ie nz sg hk kr tw za ae"
  ).split(" "),
);

/** Technology names that survive the suffix check because their ending is a real TLD. */
const NOT_A_DOMAIN = new Set(["asp.net", "vb.net", "ado.net", "socket.io", "ejs.co"]);

/**
 * Hosts that turn up on resumes without being the candidate's own site: mail
 * providers, and the badge, course and puzzle sites people link certificates on.
 */
const KNOWN_HOST =
  /(^|\.)(gmail\.com|googlemail\.com|yahoo\.[a-z.]+|outlook\.com|hotmail\.com|protonmail\.com|icloud\.com|example\.com|w3\.org|adobe\.com|linkedin\.com|github\.com|credly\.com|youracclaim\.com|coursera\.org|udemy\.com|edx\.org|leetcode\.com|hackerrank\.com|codechef\.com|geeksforgeeks\.org|stackoverflow\.com|w3schools\.com|microsoft\.com|google\.com|amazon\.com|aws\.amazon\.com|oracle\.com)$/;

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
    return line
      .split(/\s+(?:at|@|-|·|\|)\s+/)[0]!
      .trim()
      .slice(0, 80);
  }
  return undefined;
}

// ------------------------------------------------------------------ experience

/** Where a work-history section starts, and where the next section ends it. */
const EXPERIENCE_HEADING = /^\s*(work\s+|professional\s+|employment\s+)?(experience|history|employment)\s*:?\s*$/im;
const NEXT_HEADING =
  /^\s*(education|academic|skills|technical skills|projects|certifications|awards|publications|interests|languages)\s*:?\s*$/im;

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
  const current = new RegExp(
    String.raw`\b(?:current|present|existing)\s*(?:ctc|salary|compensation|package)\s*[:\-–]?\s*${AMOUNT}`,
    "i",
  ).exec(text);
  const expected = new RegExp(
    String.raw`\b(?:expected|desired|expecting)\s*(?:ctc|salary|compensation|package)\s*[:\-–]?\s*${AMOUNT}`,
    "i",
  ).exec(text);
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
  if (
    /\b(?:notice\s*period\s*[:\-–]?\s*)?(?:immediate(?:ly)?\s*(?:joiner|available|joining)|available\s*immediately|serving\s*notice\s*period\s*[:\-–]?\s*immediate)\b/i.test(
      text,
    )
  ) {
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
