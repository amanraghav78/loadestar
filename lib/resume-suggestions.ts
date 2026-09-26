import type { ResumeEducation, ResumeExperience } from "@/lib/resume-builder";

/**
 * Suggestions shown next to the field they are about.
 *
 * The ATS review (lib/ats-check.ts) grades the document as a whole: "3 of 8
 * bullets carry a number". That tells a candidate there is a problem but not
 * where. These say which line, and what to write instead, so the fix is made
 * where the eye already is.
 *
 * Pure, so the builder runs them on every keystroke and tests read them
 * without a browser.
 */

/**
 * Openers that describe what someone did. Not a style rule for its own sake:
 * "Responsible for the payments service" and "Rebuilt the payments service" are
 * the difference between a line a recruiter skims past and one they read.
 */
export const ACTION_VERBS = new Set(
  (
    "achieved added analysed analyzed architected automated built centralised centralized consolidated converted " +
    "coordinated created cut debugged decreased delivered deployed designed developed diagnosed doubled drove " +
    "eliminated engineered established expanded extended fixed founded generated grew halved implemented improved " +
    "increased initiated integrated introduced launched led maintained managed mentored migrated modelled modeled " +
    "modernised modernized negotiated onboarded optimised optimized orchestrated organised organized owned partnered " +
    "ported presented prototyped published ran rearchitected rebuilt reduced refactored released removed replaced " +
    "researched resolved restructured revamped rewrote rolled saved scaled secured shipped simplified solved sped " +
    "standardised standardized streamlined supported taught tested tracked trained tripled unified upgraded won wrote"
  ).split(" "),
);

/**
 * Openers that say someone was near the work rather than what they did, with
 * verbs that usually fit the same sentence better.
 */
const WEAK_OPENERS: Array<[RegExp, string]> = [
  [/^(was |were )?responsible for\b/i, "Owned, Ran or Led"],
  [/^(i )?worked (on|with|in)\b/i, "Built, Shipped or Developed"],
  [/^(i )?(helped|assisted)( in| with| to)?\b/i, "the part you did yourself — Built, Wrote, Fixed"],
  [/^(was )?involved in\b/i, "what you did — Built, Designed, Tested"],
  [/^(i )?participated in\b/i, "Contributed to, or what you did"],
  [/^(i )?handled\b/i, "Managed, Resolved or Ran"],
  [/^(was )?part of\b/i, "what you did in the team"],
  [/^(was )?tasked with\b/i, "the verb for the task itself"],
  [/^duties (included|include)\b/i, "one bullet per result, each starting with a verb"],
  [/^(i )?did\b/i, "a specific verb — Built, Ran, Wrote"],
  [/^(i )?(learned|learnt)\b/i, "what you built with it"],
];

const firstWord = (text: string) => (text.toLowerCase().match(/[a-z]+/) ?? [""])[0];

export const startsWithVerb = (text: string) => ACTION_VERBS.has(firstWord(text));

export const hasNumber = (text: string) => /\d|\b(?:half|double|doubled|tripled|twice)\b/i.test(text);

/** Past two printed lines at the resume's width. */
export const LONG_BULLET = 220;

export type Hint = { tone: "warn" | "fail"; text: string };

/** What to change about one bullet, most important first. Empty when it reads well. */
export function bulletHints(bullet: string): Hint[] {
  const text = bullet.trim();
  if (!text) return [];
  const hints: Hint[] = [];

  const weak = WEAK_OPENERS.find(([re]) => re.test(text));
  if (weak) {
    const opener = weak[0].exec(text)![0];
    hints.push({ tone: "warn", text: `“${opener}” says you were near the work. Try ${weak[1]}.` });
  } else if (/^i\b/i.test(text)) {
    hints.push({ tone: "warn", text: "Drop the “I” and start with the verb." });
  } else if (!startsWithVerb(text)) {
    hints.push({ tone: "warn", text: "Start with what you did — Built, Led, Cut, Shipped." });
  }

  if (!hasNumber(text)) {
    hints.push({ tone: "warn", text: "Add a number if you have one: users, %, ₹, time saved, team size." });
  }
  if (text.length > LONG_BULLET) {
    hints.push({ tone: "warn", text: `${text.length} characters — past two lines. Split it into two results.` });
  } else if (text.length < 25) {
    hints.push({ tone: "warn", text: "Short. Say what came of it." });
  }
  return hints;
}

const NUMBER_HINT = /^Add a number/;

/**
 * Hints for each line of one entry's bullets. Not every line needs a number,
 * so once about half of them carry one the per-line number nudge is dropped:
 * the aim is a readable resume, not a checklist.
 */
export function bulletListHints(bullets: string[]): Hint[][] {
  const written = bullets.filter((b) => b.trim());
  const numbered = written.filter(hasNumber).length;
  const enough = written.length > 0 && numbered / written.length >= 0.5;
  return bullets.map((b) => bulletHints(b).filter((h) => !(enough && NUMBER_HINT.test(h.text))));
}

// ------------------------------------------------------------------ dates

/** "2021-03" → 2021.25, "2021" → 2021; null for what we can't compare ("Summer 2022"). */
function dateValue(value: string): number | null {
  const text = value.trim();
  const month = /^(\d{4})-(\d{1,2})$/.exec(text);
  if (month) return Number(month[1]) + (Number(month[2]) - 1) / 12;
  const year = /^(\d{4})$/.exec(text);
  return year ? Number(year[1]) : null;
}

export type ExperienceHints = { dates?: Hint; bullets?: Hint; lines: Hint[][] };

/** What is missing or wrong on one role, keyed by the field to change. */
export function experienceHints(entry: ExperienceHint, now: Date = new Date()): ExperienceHints {
  const lines = bulletListHints(entry.bullets);
  const started = entry.role.trim() || entry.company.trim();
  if (!started) return { lines };

  let dates: Hint | undefined;
  const from = dateValue(entry.start);
  const to = entry.current ? null : dateValue(entry.end);
  const thisMonth = now.getFullYear() + now.getMonth() / 12;
  if (!entry.start.trim()) {
    dates = { tone: "fail", text: "Add a start date. A role without dates reads as a gap." };
  } else if (!entry.current && !entry.end.trim()) {
    dates = { tone: "fail", text: "Add an end date, or tick “I still work here”." };
  } else if (from !== null && to !== null && to < from) {
    dates = { tone: "fail", text: "The end date is before the start date." };
  } else if (from !== null && from > thisMonth + 1 / 12) {
    dates = { tone: "warn", text: "The start date is in the future." };
  }

  const written = entry.bullets.filter((b) => b.trim()).length;
  const bullets: Hint | undefined =
    written === 0
      ? {
          tone: "fail",
          text: "Add what you did here, one bullet per line. Three to five is the shape recruiters read.",
        }
      : written < 2
        ? { tone: "warn", text: "One bullet. Add one or two more results from this role." }
        : written > 6
          ? { tone: "warn", text: `${written} bullets. Keep the best five; the rest dilute them.` }
          : undefined;

  return { dates, bullets, lines };
}

type ExperienceHint = Pick<ResumeExperience, "role" | "company" | "start" | "end" | "current" | "bullets">;

export type EducationHints = { end?: Hint; detail?: Hint };

/**
 * Indian applications filter on the year and the result, so both are worth a
 * nudge — the result softly, because not everyone wants to print theirs.
 */
export function educationHints(entry: ResumeEducation): EducationHints {
  if (!entry.degree.trim() && !entry.institution.trim()) return {};
  const out: EducationHints = {};
  if (!entry.end.trim()) out.end = { tone: "warn", text: "Add the year you finished, or expect to." };
  if (!entry.detail.trim()) {
    out.detail = { tone: "warn", text: "Add your CGPA (8.2/10) or percentage (78%) if it helps you." };
  } else if (/^\d{1,2}(\.\d+)?$/.test(entry.detail.trim())) {
    out.detail = { tone: "warn", text: "Say what the number is: “CGPA 8.2/10” or “78%”." };
  }
  return out;
}

export function headlineHint(headline: string): Hint | undefined {
  const text = headline.trim();
  if (!text) return { tone: "fail", text: "Name the role you want, the way a posting would title it." };
  if (text.length > 70) return { tone: "warn", text: "Shorten this to the job title itself." };
  return undefined;
}

export function summaryHint(summary: string): Hint | undefined {
  const text = summary.trim();
  if (!text) return undefined;
  if (text.length < 120)
    return { tone: "warn", text: `${text.length} characters. Two or three lines is about 150–400.` };
  if (text.length > 700) return { tone: "warn", text: `${text.length} characters. Cut it back to three lines.` };
  if (/\b(i am|i'm|my)\b/i.test(text) && /^(i|my)\b/i.test(text)) {
    return { tone: "warn", text: "Resumes skip “I” and “my”: “Backend engineer with six years…”." };
  }
  return undefined;
}

export function skillsHint(skills: string[]): Hint | undefined {
  const list = skills.filter((s) => s.trim());
  if (list.length === 0) return undefined;
  if (list.length < 6) return { tone: "warn", text: `${list.length} listed. Six to fifteen is the right number.` };
  if (list.length > 20) return { tone: "warn", text: `${list.length} listed. Keep the ones this role needs.` };
  const long = list.find((s) => s.length > 30);
  if (long) return { tone: "warn", text: `“${long.slice(0, 30)}…” reads as a sentence. Keep each skill to a name.` };
  return undefined;
}
