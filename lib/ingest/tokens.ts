import type { JobSource } from "@/lib/generated/prisma/enums";

export type SyncedSource = Exclude<JobSource, "MANUAL">;

/** Board-token format per careers-site system, shown in the admin form and enforced by the validator. */
export const TOKEN_HINT: Record<SyncedSource, { label: string; example: string; pattern: RegExp }> = {
  GREENHOUSE: { label: "Greenhouse", example: "stripe", pattern: /^[a-z0-9_.-]{1,80}$/i },
  LEVER: { label: "Lever", example: "cred", pattern: /^[a-z0-9_.-]{1,80}$/i },
  ASHBY: { label: "Ashby", example: "sarvam", pattern: /^[a-z0-9_.-]{1,80}$/i },
  WORKDAY: {
    label: "Workday",
    example: "nvidia.wd5.myworkdayjobs.com|nvidia|NVIDIAExternalCareerSite",
    pattern: /^[a-z0-9.-]+\.(myworkdayjobs|myworkdaysite)\.com\|[a-z0-9_-]+\|[a-z0-9_-]+$/i,
  },
  SMARTRECRUITERS: { label: "SmartRecruiters", example: "BoschGroup", pattern: /^[a-z0-9_.-]{1,80}$/i },
  EIGHTFOLD: {
    label: "Eightfold",
    example: "careers.qualcomm.com|qualcomm.com",
    pattern: /^[a-z0-9.-]+\.[a-z]{2,}\|[a-z0-9.-]+\.[a-z]{2,}$/i,
  },
  ORACLE: {
    label: "Oracle Recruiting",
    example: "jpmc.fa.oraclecloud.com|CX_1001|300000000289360",
    pattern: /^[a-z0-9.-]+\.oraclecloud\.com\|[a-z0-9_]+\|\d+$/i,
  },
  AMAZON: { label: "Amazon Jobs", example: "IND", pattern: /^[A-Z]{3}$/ },
};

/** A company may list several career sites, separated by spaces. */
export function splitTokens(atsToken: string) {
  return atsToken.split(/\s+/).filter(Boolean);
}
