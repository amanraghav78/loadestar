import { extractTags } from "@/lib/ingest/classify";
import { allBullets, type ResumeContent } from "@/lib/resume-builder";

/**
 * Tailoring a resume to one job, without guessing: which of the posting's
 * skills and keywords the resume already says, and which it doesn't.
 *
 * The job's keywords are its tags plus what the same tagger
 * (lib/ingest/classify.ts) finds in its title and description, so a keyword
 * here is exactly what a keyword filter on the posting would look for. A
 * keyword counts as present when the tagger finds it in the resume or the word
 * appears there as written. Nothing is rewritten for the candidate: they are
 * shown the gap and decide which of those skills they genuinely have.
 *
 * Pure and deterministic — no model, no network — so it runs in the browser as
 * they type and the same input always gives the same answer.
 */

export type JobForTailoring = {
  slug: string;
  title: string;
  companyName: string;
  tags: string[];
  /** Plain text; markup is harmless, it just isn't read as a keyword. */
  description: string;
};

export type KeywordGap = {
  /** Every keyword the posting asks for, most emphasised first. */
  keywords: string[];
  matched: string[];
  missing: string[];
  /** Present somewhere in the resume but not on the skills line, which is what filters read first. */
  notInSkills: string[];
  /** 0–100: the share of the posting's keywords the resume carries. */
  coverage: number;
  /** Whether the target role under the name shares the posting's title words. */
  titleMatches: boolean;
};

/** How many of the posting's keywords are worth showing; past this they are noise. */
const MAX_KEYWORDS = 15;

/** Words in a job title that don't make it a different job. */
const TITLE_FILLER = new Set(
  "a an and the of for in at to with i ii iii iv sr jr senior junior lead staff principal associate - – / & remote india hybrid".split(
    " ",
  ),
);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word, case-insensitive, and tolerant of the punctuation in "C++" or "Node.js". */
const mentions = (text: string, keyword: string) =>
  new RegExp(`(^|[^a-z0-9+#.])${escape(keyword.toLowerCase())}($|[^a-z0-9+#])`).test(text);

export function jobKeywords(job: Pick<JobForTailoring, "title" | "tags" | "description">): string[] {
  const seen = new Map<string, string>();
  for (const keyword of [...job.tags, ...extractTags(job.title, job.description, MAX_KEYWORDS)]) {
    const clean = keyword.trim();
    if (clean && !seen.has(clean.toLowerCase())) seen.set(clean.toLowerCase(), clean);
  }
  return [...seen.values()].slice(0, MAX_KEYWORDS);
}

const titleWords = (title: string) =>
  title
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 1 && !TITLE_FILLER.has(w));

export function keywordGap(content: ResumeContent, job: JobForTailoring): KeywordGap {
  const skillsLine = content.skills.join(", ");
  const everything = [
    content.headline,
    content.summary,
    skillsLine,
    ...content.experience.map((e) => e.role),
    ...content.projects.map((p) => p.name),
    ...content.certifications.map((c) => c.name),
    ...allBullets(content),
  ].join("\n");
  const lower = everything.toLowerCase();
  const lowerSkills = skillsLine.toLowerCase();

  const found = new Set(extractTags(content.headline, everything, 200).map((t) => t.toLowerCase()));
  const inSkills = new Set(extractTags("", skillsLine, 200).map((t) => t.toLowerCase()));

  const keywords = jobKeywords(job);
  const matched: string[] = [];
  const missing: string[] = [];
  const notInSkills: string[] = [];
  for (const keyword of keywords) {
    const key = keyword.toLowerCase();
    if (found.has(key) || mentions(lower, keyword)) {
      matched.push(keyword);
      if (!inSkills.has(key) && !mentions(lowerSkills, keyword)) notInSkills.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  // Most of the posting's title words ("backend", "engineer") in the target
  // role is a match; "Senior" and "Lead" don't count either way.
  const wanted = titleWords(job.title);
  const have = new Set(titleWords(content.headline));
  const shared = wanted.filter((w) => have.has(w)).length;
  const titleMatches = wanted.length === 0 || shared / wanted.length >= 0.5;

  return {
    keywords,
    matched,
    missing,
    notInSkills,
    coverage: keywords.length === 0 ? 100 : Math.round((matched.length / keywords.length) * 100),
    titleMatches,
  };
}
