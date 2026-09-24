import { formatInrShort } from "@/lib/format";
import type { Level } from "@/lib/generated/prisma/enums";

/**
 * Ranking open roles against a candidate's profile. Pure and unit-tested: the
 * database work (which roles to even consider) lives in lib/account-queries.ts.
 *
 * The match is deliberately explainable. Every role we put in front of someone
 * comes with the reasons it scored, because a recommendation a candidate can't
 * see the logic of is one they can't correct by editing their profile.
 */

/**
 * Levels worth showing at a given amount of experience, widened by one step on
 * each side: titles are inconsistent between employers, and a good role a rung
 * away is better than an empty page.
 */
export function levelsForExperience(years: number | null | undefined): Level[] {
  if (years == null) return [];
  if (years <= 0) return ["INTERN", "JUNIOR"];
  if (years === 1) return ["JUNIOR", "MID"];
  if (years <= 3) return ["JUNIOR", "MID", "SENIOR"];
  if (years <= 6) return ["MID", "SENIOR"];
  if (years <= 9) return ["SENIOR", "STAFF", "MANAGER"];
  if (years <= 13) return ["SENIOR", "STAFF", "PRINCIPAL", "MANAGER"];
  return ["STAFF", "PRINCIPAL", "MANAGER", "DIRECTOR"];
}

export type MatchProfile = {
  skills: string[];
  yearsExperience: number | null;
  city: string | null;
  expectedSalary: number | null;
};

export type ScorableJob = {
  tags: string[];
  level: Level;
  location: string;
  remote: "ONSITE" | "HYBRID" | "REMOTE";
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
};

export type MatchScore = {
  score: number;
  /** Which of the candidate's skills this role asks for, in the role's order. */
  matchedSkills: string[];
  /** Short phrases for the UI, strongest first. */
  reasons: string[];
};

const WEIGHT = {
  skill: 3,
  /** Beyond four skills the extra overlap says little, so it stops counting. */
  maxSkills: 4,
  level: 4,
  city: 3,
  remote: 1,
  meetsExpectation: 4,
  publishesSalary: 1,
} as const;

export function scoreJob(job: ScorableJob, profile: MatchProfile): MatchScore {
  const wanted = new Set(profile.skills.map((s) => s.toLowerCase()));
  const matchedSkills = job.tags.filter((tag) => wanted.has(tag.toLowerCase()));

  const reasons: string[] = [];
  let score = Math.min(matchedSkills.length, WEIGHT.maxSkills) * WEIGHT.skill;

  if (matchedSkills.length > 0) reasons.push(skillReason(matchedSkills));

  const levels = levelsForExperience(profile.yearsExperience);
  if (levels.includes(job.level)) score += WEIGHT.level;

  if (profile.city && job.remote === "REMOTE") {
    score += WEIGHT.remote;
    reasons.push("Remote");
  } else if (profile.city && job.location.toLowerCase().includes(profile.city.toLowerCase())) {
    score += WEIGHT.city;
    reasons.push(`In ${profile.city}`);
  }

  // Only INR bands are comparable to what an Indian candidate expects.
  if (job.currency === "INR" && job.salaryMax != null) {
    score += WEIGHT.publishesSalary;
    if (profile.expectedSalary != null && job.salaryMax >= profile.expectedSalary) {
      score += WEIGHT.meetsExpectation;
      reasons.push(`Pays up to ₹${formatInrShort(job.salaryMax)}`);
    }
  }

  return { score, matchedSkills, reasons };
}

function skillReason(matched: string[]): string {
  const [first, second, ...rest] = matched;
  if (rest.length > 0) return `${first}, ${second} and ${rest.length} more match`;
  if (second) return `${first} and ${second} match`;
  return `${first} matches`;
}

/**
 * What the candidate still has to fill in before matching means anything.
 * Skills carry the ranking, so without them there is nothing to rank on.
 */
export function matchingReadiness(profile: MatchProfile): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (profile.skills.length === 0) missing.push("your skills");
  if (profile.yearsExperience == null) missing.push("your years of experience");
  return { ready: profile.skills.length > 0, missing };
}
