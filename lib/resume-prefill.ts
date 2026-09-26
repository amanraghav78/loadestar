import { extractTags } from "@/lib/ingest/classify";
import { namesDegree, parseResumeText, readEducationLine } from "@/lib/resume-parse";
import {
  EMPTY_RESUME,
  type ResumeCertification,
  type ResumeContent,
  type ResumeEducation,
  type ResumeExperience,
  type ResumeProject,
} from "@/lib/resume-builder";

/**
 * Where a candidate's resume starts from, so nobody opens the builder on a
 * blank page and types out what they have already told us.
 *
 * Two sources, both guesses the candidate checks before anything is kept:
 *
 * - `starterResume` — the profile: target role, skills and highest
 *   qualification, which are what the header, skills line and education
 *   section of a resume say anyway.
 * - `resumeFromText` — the text of a resume they already have (a PDF they
 *   upload), read into the builder's sections: summary, roles with their dates
 *   and bullets, projects, education, certifications and skills.
 *
 * `mergeResume` then fills only what is still empty, so importing never
 * overwrites something the candidate wrote here themselves.
 *
 * Pure and dependency-free, like the rest of the resume modules.
 */

/** What the profile knows that belongs on a resume. */
export type ProfileForResume = {
  currentTitle?: string | null;
  skills?: string[] | null;
  degree?: string | null;
  institution?: string | null;
  graduationYear?: number | null;
};

export function starterResume(profile: ProfileForResume | null | undefined): ResumeContent {
  const education: ResumeEducation[] =
    profile?.degree?.trim() || profile?.institution?.trim()
      ? [
          {
            degree: profile.degree?.trim() ?? "",
            institution: profile.institution?.trim() ?? "",
            location: "",
            start: "",
            end: profile.graduationYear ? String(profile.graduationYear) : "",
            detail: "",
          },
        ]
      : [];

  return {
    ...EMPTY_RESUME,
    headline: profile?.currentTitle?.trim() ?? "",
    skills: [...(profile?.skills ?? [])],
    education,
  };
}

// ------------------------------------------------------------------ sections

type Section = "summary" | "experience" | "projects" | "education" | "skills" | "certifications" | "other";

/**
 * The headings resumes actually use, per section. A line is a heading only
 * when it is one of these and nothing else, so "Skills: Python, Go" stays a
 * line of skills rather than starting an empty section.
 */
const HEADINGS: Array<[Section, RegExp]> = [
  ["summary", /^(professional |career |profile )?(summary|objective|profile|about( me)?|career objective)$/],
  [
    "experience",
    /^(work |professional |relevant |employment |industry )?(experience|history|employment( history)?|internships?|work history)$/,
  ],
  ["projects", /^(academic |personal |key |selected |notable )?projects?$/],
  [
    "education",
    /^(education(al)?( qualifications?| details| background)?|academic (details|qualifications?|background)|qualifications?)$/,
  ],
  [
    "skills",
    /^(technical |key |core |professional )?(skills|competencies|technologies|tech stack|tools( and technologies)?|skills (and|&) (tools|technologies))$/,
  ],
  [
    "certifications",
    /^(certifications?|certificates?|licenses?( (and|&) certifications)?|courses|certifications? (and|&) courses|training)$/,
  ],
  [
    "other",
    /^(achievements|awards|honou?rs|publications|interests|hobbies|languages( known)?|extra[- ]curricular( activities)?|positions of responsibility|volunteering|declaration|personal (details|information)|references)$/,
  ],
];

function headingOf(line: string): Section | null {
  if (line.length > 45) return null;
  const text = line
    .toLowerCase()
    .replace(/[:\-–|•]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  for (const [section, re] of HEADINGS) if (re.test(text)) return section;
  return null;
}

/** Bullet glyphs PDFs come out with, and the dash people type instead. */
const BULLET = /^\s*(?:[•●▪◦‣∙○■□➢➤►*]|-\s|–\s|\d{1,2}[.)]\s)\s*/;

const isBullet = (line: string) => BULLET.test(line);
const stripBullet = (line: string) => line.replace(BULLET, "").trim();

// ------------------------------------------------------------------ dates

const MONTH = String.raw`(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?`;
const POINT = String.raw`\b(?:${MONTH}\s*'?\s*(?:19|20)?\d{2}|(?:0?[1-9]|1[0-2])\s*[/.-]\s*(?:19|20)\d{2}|(?:19|20)\d{2})\b`;
const OPEN_END = String.raw`(?:present|current(?:ly)?|now|till date|to date|ongoing)`;
/** "Mar 2020 – Present", "2017 - 2020", "06/2019 to 08/2021", "Jan '22 – Dec '23". */
const RANGE = new RegExp(String.raw`\(?\s*(${POINT})\s*(?:-|–|—|to|till)\s*(${POINT}|${OPEN_END})\s*\)?`, "i");
const LONE = new RegExp(String.raw`^\(?\s*(${POINT})\s*\)?$`, "i");

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** One end of a range, as the builder stores it: "2020-03" when there is a month, "2020" when there isn't. */
export function toResumeDate(point: string): string {
  const text = point.trim().toLowerCase();
  const named = new RegExp(String.raw`^(${MONTH})\s*'?\s*((?:19|20)?\d{2})$`, "i").exec(text);
  if (named) {
    const month = MONTHS.indexOf(named[1]!.slice(0, 3)) + 1;
    const year = named[2]!.length === 2 ? `20${named[2]}` : named[2]!;
    return month > 0 ? `${year}-${String(month).padStart(2, "0")}` : year;
  }
  const numeric = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(text);
  if (numeric) return `${numeric[2]}-${numeric[1]!.padStart(2, "0")}`;
  const year = /^((?:19|20)\d{2})$/.exec(text);
  return year ? year[1]! : point.trim();
}

type Dates = { start: string; end: string; current: boolean };

function readDates(line: string): { dates: Dates; rest: string } | null {
  const range = RANGE.exec(line);
  if (range) {
    const current = new RegExp(`^${OPEN_END}$`, "i").test(range[2]!.trim());
    return {
      dates: { start: toResumeDate(range[1]!), end: current ? "" : toResumeDate(range[2]!), current },
      rest: tidy(line.replace(range[0], " ")),
    };
  }
  const lone = LONE.exec(line.trim());
  if (lone) return { dates: { start: toResumeDate(lone[1]!), end: "", current: false }, rest: "" };
  return null;
}

/** Separators left dangling once a date or a label has been cut out of a line. */
const tidy = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .replace(/^[\s,|•·:;\-–—()]+|[\s,|•·:;\-–—()]+$/g, "")
    .trim();

// ------------------------------------------------------------------ roles

/** Words that make a phrase a job title rather than an employer. */
const ROLE_WORD =
  /\b(engineer|developer|programmer|architect|designer|manager|analyst|scientist|consultant|administrator|specialist|lead|intern|associate|executive|officer|head|director|trainee|tester|devops|sde|founder|co-founder)\b/i;

/**
 * "Senior Data Engineer, Acme Analytics - Hyderabad", "Acme | Backend Developer",
 * "Software Engineer at Initech, Pune" → the role, the employer and where.
 */
export function readRoleLine(line: string): Pick<ResumeExperience, "role" | "company" | "location"> {
  const parts = line
    .split(/\s+at\s+|\s*[|•·,]\s*|\s+[-–—]\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { role: "", company: "", location: "" };
  if (parts.length === 1) {
    return ROLE_WORD.test(parts[0]!)
      ? { role: parts[0]!, company: "", location: "" }
      : { role: "", company: parts[0]!, location: "" };
  }
  // Whichever of the first two reads like a title is the title.
  const [a, b, ...rest] = parts as [string, string, ...string[]];
  const titleFirst = ROLE_WORD.test(a) || !ROLE_WORD.test(b);
  return {
    role: (titleFirst ? a : b).slice(0, 100),
    company: (titleFirst ? b : a).slice(0, 100),
    location: rest.join(", ").slice(0, 60),
  };
}

/** A wrapped line from a PDF: it continues the sentence above instead of starting its own. */
const continues = (line: string) => /^[a-z(&,]/.test(line);

/** Bullets of one entry, joining lines a PDF wrapped back into the sentence they came from. */
function pushBullet(bullets: string[], line: string, bulleted: boolean) {
  const text = stripBullet(line);
  if (!text) return;
  if (!bulleted && bullets.length > 0 && continues(text)) {
    bullets[bullets.length - 1] = `${bullets.at(-1)} ${text}`;
  } else {
    bullets.push(text);
  }
}

function readExperience(lines: string[]): ResumeExperience[] {
  const entries: ResumeExperience[] = [];
  let current: ResumeExperience | null = null;

  const start = (header: string, dates: Dates | null) => {
    current = {
      ...readRoleLine(header),
      start: dates?.start ?? "",
      end: dates?.end ?? "",
      current: dates?.current ?? false,
      bullets: [],
    };
    entries.push(current);
  };

  lines.forEach((line, i) => {
    const bulleted = isBullet(line);
    const dated = bulleted ? null : readDates(line);
    const next = lines[i + 1] ?? "";
    const entry = current as ResumeExperience | null;

    if (dated) {
      // A role's own line with its dates on it, or a line of dates under one.
      if (dated.rest && (!entry || entry.bullets.length > 0 || entry.start)) start(dated.rest, dated.dates);
      else if (dated.rest && entry) Object.assign(entry, readRoleLine(dated.rest), dated.dates);
      else if (entry && !entry.start) Object.assign(entry, dated.dates);
      return;
    }
    // A plain line directly above a line of dates is the next role's header.
    const nextDated = !isBullet(next) && readDates(next);
    if (!bulleted && !continues(line) && line.length <= 100 && nextDated && !nextDated.rest) {
      if (!entry || entry.bullets.length > 0 || entry.start) start(line, null);
      else Object.assign(entry, readRoleLine(line));
      return;
    }
    if (!entry) {
      // Text before any header: most likely the first role, written without dates.
      if (!bulleted && line.length <= 100 && ROLE_WORD.test(line)) start(line, null);
      return;
    }
    pushBullet(entry.bullets, line, bulleted);
  });

  return entries
    .filter((e) => e.role || e.company)
    .slice(0, 15)
    .map((e) => ({ ...e, bullets: e.bullets.slice(0, 12).map((b) => b.slice(0, 400)) }));
}

// ------------------------------------------------------------------ the rest

function readProjects(lines: string[]): ResumeProject[] {
  const projects: ResumeProject[] = [];
  for (const line of lines) {
    const bulleted = isBullet(line);
    const last = projects.at(-1);
    // A short line that isn't a bullet or a sentence is a project's name.
    const looksLikeName = !bulleted && !continues(line) && line.length <= 90 && !/\.\s*$/.test(line);
    if (looksLikeName && (!last || last.bullets.length > 0)) {
      const link =
        /\b(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|[a-z0-9-]+\.(?:vercel\.app|netlify\.app|dev|io|app))\/?[^\s|,)]*/i.exec(
          line,
        );
      const dated = readDates(line);
      const name = tidy((link ? line.replace(link[0], " ") : line).replace(dated ? RANGE : /$^/, " "));
      projects.push({ name: name.slice(0, 100), link: link?.[0].slice(0, 300) ?? "", bullets: [] });
    } else if (last) {
      pushBullet(last.bullets, line, bulleted);
    }
  }
  return projects
    .filter((p) => p.name)
    .slice(0, 10)
    .map((p) => ({ ...p, bullets: p.bullets.slice(0, 12).map((b) => b.slice(0, 400)) }));
}

function readEducation(lines: string[], now: Date): ResumeEducation[] {
  const entries: ResumeEducation[] = [];
  lines.forEach((line, i) => {
    const text = stripBullet(line);
    if (!namesDegree(text)) return;
    const next = stripBullet(lines[i + 1] ?? "");
    // The line after belongs to this entry only when it isn't a qualification itself.
    const read = readEducationLine(text, namesDegree(next) ? "" : next, now);
    if (read.degree || read.institution) entries.push({ ...read, location: "" });
  });
  return entries.slice(0, 8);
}

function readCertifications(lines: string[]): ResumeCertification[] {
  return lines
    .map(stripBullet)
    .filter((line) => line.length >= 3 && line.length <= 160)
    .slice(0, 12)
    .map((line) => {
      const year = /\b((?:19|20)\d{2})\b/.exec(line)?.[1] ?? "";
      const [name = "", issuer = ""] = tidy(line.replace(year, " "))
        .split(/\s+by\s+|\s*[|,]\s*|\s+[-–—]\s+/i)
        .map((p) => tidy(p));
      return { name: name.slice(0, 120), issuer: issuer.slice(0, 100), year };
    })
    .filter((c) => c.name);
}

/** "Languages: Python, Go" → Python, Go. Labels go; items stay spelled as written. */
function readSkillsSection(lines: string[]): string[] {
  return lines
    .flatMap((line) =>
      stripBullet(line)
        .replace(/^[A-Za-z &/]{2,30}:\s*/, "")
        .split(/\s*[,|•;·]\s*/),
    )
    .map((s) => s.trim())
    .filter((s) => s.length >= 1 && s.length <= 30 && !/[.!?]$/.test(s));
}

/** Case-insensitive union, first spelling kept. */
export function mergeSkills(...lists: string[][]): string[] {
  const seen = new Map<string, string>();
  for (const skill of lists.flat()) {
    const clean = skill.trim();
    if (clean && !seen.has(clean.toLowerCase())) seen.set(clean.toLowerCase(), clean);
  }
  return [...seen.values()];
}

/**
 * A resume's plain text, read into the builder's sections. Sections that the
 * text doesn't have come back empty; nothing here invents content.
 */
export function resumeFromText(raw: string, now: Date = new Date()): ResumeContent {
  const text = raw
    .slice(0, 120_000)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[ \t]+/g, " ");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const sections: Record<Section, string[]> = {
    summary: [],
    experience: [],
    projects: [],
    education: [],
    skills: [],
    certifications: [],
    other: [],
  };
  let section: Section | null = null;
  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) section = heading;
    else if (section) sections[section].push(line);
  }

  const profile = parseResumeText(text, now);
  const skills = mergeSkills(readSkillsSection(sections.skills), extractTags("", text, 30)).slice(0, 40);

  return {
    headline: (profile.currentTitle ?? "").slice(0, 120),
    summary: sections.summary
      .filter((l) => !/\b(ctc|notice period|salary)\b/i.test(l))
      .map(stripBullet)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500),
    skills,
    experience: readExperience(sections.experience),
    projects: readProjects(sections.projects),
    // Only the education section: "MS Office" in a skills line is not a master's.
    education: readEducation(sections.education, now),
    certifications: readCertifications(sections.certifications),
  };
}

// ------------------------------------------------------------------ merging

const filled = {
  experience: (e: ResumeExperience) => Boolean(e.role.trim() || e.company.trim()),
  projects: (p: ResumeProject) => Boolean(p.name.trim()),
  education: (e: ResumeEducation) => Boolean(e.degree.trim() || e.institution.trim()),
  certifications: (c: ResumeCertification) => Boolean(c.name.trim()),
};

export type MergeResult = {
  content: ResumeContent;
  /** The sections that changed, in words for the status line ("2 roles", "skills"). */
  filled: string[];
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Lays an imported resume over the one being written, filling only what is
 * still empty. A section the candidate has started is theirs and is left
 * alone; skills are the exception, and are added to rather than replaced.
 */
export function mergeResume(current: ResumeContent, imported: ResumeContent): MergeResult {
  const out: ResumeContent = { ...current };
  const changed: string[] = [];

  if (!current.headline.trim() && imported.headline) {
    out.headline = imported.headline;
    changed.push("target role");
  }
  if (!current.summary.trim() && imported.summary) {
    out.summary = imported.summary;
    changed.push("summary");
  }
  const skills = mergeSkills(current.skills, imported.skills).slice(0, 40);
  if (skills.length > current.skills.length) {
    out.skills = skills;
    changed.push(plural(skills.length - current.skills.length, "skill"));
  }

  const sections = [
    ["experience", "role"],
    ["projects", "project"],
    ["education", "qualification"],
    ["certifications", "certification"],
  ] as const;
  for (const [key, noun] of sections) {
    const isFilled = filled[key] as (entry: unknown) => boolean;
    const incoming = (imported[key] as unknown[]).filter(isFilled);
    if (incoming.length > 0 && !(current[key] as unknown[]).some(isFilled)) {
      (out as Record<string, unknown>)[key] = incoming;
      changed.push(plural(incoming.length, noun));
    }
  }

  return { content: out, filled: changed };
}

/** Whether there is anything on the page yet, which decides whether to offer an import. */
export function isBlankResume(content: ResumeContent) {
  return (
    !content.summary.trim() &&
    !content.experience.some(filled.experience) &&
    !content.projects.some(filled.projects) &&
    !content.certifications.some(filled.certifications)
  );
}
