import Link from "next/link";
import { Check, Plus } from "lucide-react";
import type { KeywordGap, JobForTailoring } from "@/lib/resume-tailor";

/**
 * "Tailor my resume for this role": the posting's keywords the resume already
 * carries and the ones it lacks (lib/resume-tailor.ts). Nothing is written for
 * the candidate. A missing keyword can be added to the skills line with one
 * click, and the panel says plainly to add only what they actually have.
 */
export function TailorPanel({
  job,
  gap,
  onAddSkill,
}: {
  job: JobForTailoring;
  gap: KeywordGap;
  onAddSkill: (skill: string) => void;
}) {
  return (
    <section className="metal rounded-3xl p-6" aria-labelledby="tailor-heading">
      <h2 id="tailor-heading" className="text-fg text-[15px] font-semibold">
        Tailoring for this role
      </h2>
      <p className="text-muted mt-1 text-sm">
        <Link href={`/jobs/${job.slug}`} className="text-fg underline underline-offset-2">
          {job.title}
        </Link>{" "}
        at {job.companyName}
      </p>

      <div className="mt-4 flex items-baseline gap-3">
        <p className="steel-text text-3xl font-semibold tracking-[-0.03em]">
          {gap.coverage}
          <span className="text-subtle text-base">%</span>
        </p>
        <p className="text-muted text-sm">
          of its keywords are on your resume ({gap.matched.length} of {gap.keywords.length})
        </p>
      </div>

      {!gap.titleMatches && (
        <p className="text-accent-fg mt-3 text-xs">
          Your target role doesn&apos;t share this posting&apos;s title. If you&apos;re applying for it, name the role
          the way the posting does.
        </p>
      )}

      {gap.missing.length > 0 && (
        <div className="mt-5">
          <h3 className="text-fg text-[13px] font-medium">Missing from your resume</h3>
          <p className="text-subtle mt-0.5 text-xs">
            Add only the ones you have really used — then show where in a bullet.
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {gap.missing.map((keyword) => (
              <li key={keyword}>
                <button type="button" className="chip gap-1" onClick={() => onAddSkill(keyword)}>
                  <Plus className="size-3" aria-hidden />
                  {keyword}
                  <span className="sr-only"> — add to skills</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gap.notInSkills.length > 0 && (
        <div className="mt-5">
          <h3 className="text-fg text-[13px] font-medium">In your bullets, not your skills line</h3>
          <p className="text-subtle mt-0.5 text-xs">Keyword filters read the skills line first.</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {gap.notInSkills.map((keyword) => (
              <li key={keyword}>
                <button type="button" className="chip gap-1" onClick={() => onAddSkill(keyword)}>
                  <Plus className="size-3" aria-hidden />
                  {keyword}
                  <span className="sr-only"> — add to skills</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gap.matched.length > 0 && (
        <div className="mt-5">
          <h3 className="text-fg text-[13px] font-medium">Already covered</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {gap.matched.map((keyword) => (
              <li
                key={keyword}
                className="border-line text-muted inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]"
              >
                <Check className="text-ok size-3" aria-hidden />
                {keyword}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="border-line text-subtle mt-5 border-t pt-4 text-xs">
        Matched word for word against the posting&apos;s skills and description. No AI rewrites your resume.
      </p>
    </section>
  );
}
