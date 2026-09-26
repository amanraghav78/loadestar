import { extractTags } from "@/lib/ingest/classify";
import { unrenderable } from "@/lib/pdf/helvetica";
import { estimatePages } from "@/lib/resume-pdf";
import {
  allBullets,
  layoutResume,
  resumePlainText,
  type ResumeContact,
  type ResumeContent,
} from "@/lib/resume-builder";
import { hasNumber, startsWithVerb } from "@/lib/resume-suggestions";

/**
 * Reviews a resume the way an applicant tracking system reads one, and says
 * what to fix.
 *
 * The rules are the boring ones that actually decide whether a record parses: a
 * real contact block, headings a parser recognises, dated roles, bullets that
 * begin with a verb and carry a number, skills spelled the way postings spell
 * them. Nothing here guesses at what a recruiter will think of the writing.
 *
 * Every check says which field to change, because a score with no instruction
 * attached is a number nobody can act on. Pure, so it runs in the browser as
 * the candidate types and on the server for the saved document.
 */

export type AtsStatus = "pass" | "warn" | "fail";

export type AtsCheck = {
  id: string;
  label: string;
  status: AtsStatus;
  /** What is wrong and what to do about it, in one sentence. */
  detail: string;
  weight: number;
  /** The id of the input to fix it in, when there is one on the builder. */
  field?: string;
  /** Where to fix it when it is not on the builder (contact details live on the profile). */
  href?: string;
};

export type AtsReport = {
  /** 0–100, weighted across the checks below. */
  score: number;
  checks: AtsCheck[];
  /** Skills written the way live postings write them (lib/ingest/classify.ts). */
  recognisedSkills: string[];
  pages: number;
};

/** A warning is half credit: the resume parses, it just reads worse than it could. */
const CREDIT: Record<AtsStatus, number> = { pass: 1, warn: 0.5, fail: 0 };

const share = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

export function reviewResume(content: ResumeContent, contact: ResumeContact): AtsReport {
  const checks: AtsCheck[] = [];
  const add = (check: AtsCheck) => checks.push(check);

  const blocks = layoutResume(content, contact);
  const pages = estimatePages(blocks);
  const bullets = allBullets(content);
  const skills = content.skills.map((s) => s.trim()).filter(Boolean);
  const summary = content.summary.trim();
  const headline = content.headline.trim();

  // The vocabulary the job feeds are tagged with, so "recognised" means a
  // posting on Lodestar could be matched on it — not that we approve of it.
  // Two readings: the whole document, which is what the panel reports, and the
  // skills line on its own, which is what the skills check is about.
  const recognisedSkills = extractTags(headline, [skills.join(", "), bullets.join(" ")].join("\n"), 40);
  const recognisedInSkills = extractTags("", skills.join(", "), 40);

  // ---------------------------------------------------------------- contact
  const missing = [
    !contact.fullName.trim() && "your name",
    !contact.phone && "a phone number",
    !contact.city && "your city",
  ].filter((v): v is string => Boolean(v));

  add({
    id: "contact",
    label: "Contact details",
    weight: 10,
    status: missing.length === 0 ? "pass" : missing.length > 1 ? "fail" : "warn",
    detail:
      missing.length === 0
        ? "Name, city, one phone number and one email, in plain text at the top."
        : `Add ${missing.join(" and ")} to your profile — a parser files a resume by its contact block.`,
  });

  const links = [contact.linkedinUrl, contact.githubUrl, contact.portfolioUrl].filter(Boolean).length;
  add({
    id: "links",
    label: "Links",
    weight: 5,
    status: links > 0 ? "pass" : "warn",
    detail:
      links > 0
        ? `${links} link${links === 1 ? "" : "s"}, written out so they survive being copied as text.`
        : "Add your LinkedIn or GitHub on your profile. Most employers look for one.",
  });

  // ---------------------------------------------------------------- headline
  add({
    id: "headline",
    label: "Target role",
    weight: 8,
    status: headline.length >= 3 && headline.length <= 70 ? "pass" : headline ? "warn" : "fail",
    detail: !headline
      ? "Name the role you want under your name, the way a posting would title it. It is the first thing matched."
      : headline.length > 70
        ? "Shorten this to the job title itself — a sentence here reads as noise."
        : "The role you want, in the words a posting would use.",
  });

  // ---------------------------------------------------------------- summary
  add({
    id: "summary",
    label: "Summary",
    weight: 8,
    status: summary.length >= 120 && summary.length <= 700 ? "pass" : summary ? "warn" : "fail",
    detail: !summary
      ? "Write two or three lines: what you do, how long you have done it, and what you want next."
      : summary.length < 120
        ? "A little short. Two or three lines gives a recruiter something to quote in their notes."
        : summary.length > 700
          ? "Long enough that nobody will read it. Cut it back to three lines."
          : "The right length: read in a glance, and full of your own keywords.",
  });

  // ---------------------------------------------------------------- experience
  const experience = content.experience.filter((e) => e.role.trim() || e.company.trim());
  const dated = experience.filter((e) => e.start.trim() && (e.current || e.end.trim()));
  add({
    id: "experience",
    label: "Experience with dates",
    weight: 14,
    status: experience.length === 0 ? "fail" : dated.length === experience.length ? "pass" : "warn",
    detail:
      experience.length === 0
        ? "Add at least one role. Everything an ATS ranks on — titles, dates, employers — comes from this section."
        : dated.length === experience.length
          ? `${experience.length} role${experience.length === 1 ? "" : "s"}, each with a title, an employer and dates.`
          : "Give every role a start and an end. Dates a parser can't read get read as a gap in your career.",
  });

  const thin = experience.filter((e) => e.bullets.filter((b) => b.trim()).length < 2);
  add({
    id: "bullets",
    label: "Bullets per role",
    weight: 12,
    status: experience.length === 0 ? "fail" : thin.length === 0 ? "pass" : "warn",
    detail:
      experience.length === 0
        ? "Nothing to review yet."
        : thin.length === 0
          ? "Every role says what you actually did, in two lines or more."
          : `${thin.length} role${thin.length === 1 ? " has" : "s have"} fewer than two bullets. Three to five each is the shape recruiters read fastest.`,
  });

  const withVerb = bullets.filter((b) => startsWithVerb(b)).length;
  const verbShare = share(withVerb, bullets.length);
  add({
    id: "verbs",
    label: "Bullets start with a verb",
    weight: 8,
    status: bullets.length === 0 ? "fail" : verbShare >= 0.7 ? "pass" : verbShare >= 0.4 ? "warn" : "fail",
    detail:
      bullets.length === 0
        ? "Write your bullets first — this check reads them."
        : `${withVerb} of ${bullets.length} open with a verb like Built, Led, Cut or Shipped. Rewrite the rest to start with what you did.`,
  });

  const withNumbers = bullets.filter(hasNumber).length;
  const numberShare = share(withNumbers, bullets.length);
  add({
    id: "metrics",
    label: "Bullets carry a number",
    weight: 10,
    status: bullets.length === 0 ? "fail" : numberShare >= 0.4 ? "pass" : numberShare > 0 ? "warn" : "fail",
    detail:
      bullets.length === 0
        ? "Nothing to review yet."
        : `${withNumbers} of ${bullets.length} carry a number — users, latency, cost, team size. Aim for about half.`,
  });

  const longBullets = bullets.filter((b) => b.length > 220).length;
  if (longBullets > 0) {
    add({
      id: "bullet-length",
      label: "Bullet length",
      weight: 3,
      status: "warn",
      detail: `${longBullets} bullet${longBullets === 1 ? " runs" : "s run"} past two lines. Split them: one result each.`,
    });
  }

  // ---------------------------------------------------------------- skills
  add({
    id: "skills",
    label: "Skills",
    weight: 12,
    status: skills.length >= 6 && recognisedInSkills.length >= 3 ? "pass" : skills.length > 0 ? "warn" : "fail",
    detail:
      skills.length === 0
        ? "List the tools you actually use. This is the section keyword filters read first."
        : skills.length < 6
          ? `Only ${skills.length} listed. Six to fifteen, spelled the way postings spell them.`
          : recognisedInSkills.length < 3
            ? "We recognise few of these from live postings. Check the spelling — Node.js, not Node JS."
            : `${skills.length} listed, ${recognisedInSkills.length} of them spelled the way live postings spell them.`,
  });

  // ---------------------------------------------------------------- education
  const education = content.education.filter((e) => e.degree.trim() || e.institution.trim());
  add({
    id: "education",
    label: "Education",
    weight: 5,
    status: education.length > 0 ? "pass" : "warn",
    detail:
      education.length > 0
        ? "Degree, institution and year, which Indian employers filter on."
        : "Add your highest qualification with its year. It is a filter on most Indian applications.",
  });

  // ---------------------------------------------------------------- the file
  add({
    id: "length",
    label: "Length",
    weight: 5,
    status: pages <= 2 ? "pass" : "warn",
    detail:
      pages <= 2
        ? `${pages} page${pages === 1 ? "" : "s"}. One page under about eight years of experience, two after.`
        : `${pages} pages. Cut the oldest roles back to a line each.`,
  });

  const lost = unrenderable(resumePlainText(content, contact));
  add({
    id: "characters",
    label: "Plain text throughout",
    weight: 3,
    status: lost.length === 0 ? "pass" : "warn",
    detail:
      lost.length === 0
        ? "No symbols or graphics for a parser to trip over."
        : `We can't print these, so they would be dropped: ${lost.slice(0, 8).join(" ")}. Write them in plain English.`,
  });

  // Each check points at the field that fixes it, so the panel can take the
  // candidate straight there instead of leaving them to find it.
  const targets = fixTargets(content);
  for (const check of checks) Object.assign(check, targets[check.id]);

  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.reduce((sum, check) => sum + check.weight * CREDIT[check.status], 0);

  return { score: Math.round(share(earned, total) * 100), checks, recognisedSkills, pages };
}

/** Wording for the score, so the number is never shown on its own. */
export function scoreVerdict(score: number) {
  if (score >= 85) return "Ready to send";
  if (score >= 70) return "Nearly there";
  if (score >= 45) return "Needs work";
  return "Not ready yet";
}

type Target = Pick<AtsCheck, "field" | "href">;

/** The first place each check can be fixed: an input on the builder, or the profile. */
function fixTargets(content: ResumeContent): Record<string, Target> {
  const started = (e: { role: string; company: string }) => Boolean(e.role.trim() || e.company.trim());
  const firstRole = (test: (e: ResumeContent["experience"][number]) => boolean) =>
    content.experience.findIndex((e) => started(e) && test(e));
  /** The first bullets box, among roles then projects, with a line that fails `test`. */
  const firstBullets = (test: (bullet: string) => boolean): string | undefined => {
    const role = content.experience.findIndex((e) => e.bullets.some((b) => b.trim() && test(b.trim())));
    if (role >= 0) return `experience-${role}-bullets`;
    const project = content.projects.findIndex((p) => p.bullets.some((b) => b.trim() && test(b.trim())));
    return project >= 0 ? `project-${project}-bullets` : undefined;
  };

  const undated = firstRole((e) => !(e.start.trim() && (e.current || e.end.trim())));
  const thin = firstRole((e) => e.bullets.filter((b) => b.trim()).length < 2);
  const anyRole = content.experience.some(started);

  return {
    contact: { href: "/account" },
    links: { href: "/account" },
    headline: { field: "headline" },
    summary: { field: "summary" },
    experience: { field: !anyRole ? "add-experience" : undated >= 0 ? `experience-${undated}-start` : undefined },
    bullets: { field: !anyRole ? "add-experience" : thin >= 0 ? `experience-${thin}-bullets` : undefined },
    verbs: { field: firstBullets((b) => !startsWithVerb(b)) },
    metrics: { field: firstBullets((b) => !hasNumber(b)) },
    "bullet-length": { field: firstBullets((b) => b.length > 220) },
    skills: { field: "skills" },
    education: { field: "add-education" },
  };
}
