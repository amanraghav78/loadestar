import { AlertTriangle, Check, X } from "lucide-react";
import { scoreVerdict, type AtsReport, type AtsStatus } from "@/lib/ats-check";

/**
 * The ATS review, shown beside the form and recomputed as the candidate types.
 *
 * Every line is an instruction, not a grade: the score is only there to say
 * whether the instructions are worth reading today. See lib/ats-check.ts for
 * what each check actually measures.
 */

const ICON: Record<AtsStatus, typeof Check> = { pass: Check, warn: AlertTriangle, fail: X };
const TONE: Record<AtsStatus, string> = { pass: "text-ok", warn: "text-accent-fg", fail: "text-danger" };

export function AtsReportPanel({ report }: { report: AtsReport }) {
  const todo = report.checks.filter((check) => check.status !== "pass");

  return (
    <section className="metal rounded-3xl p-6" aria-labelledby="ats-heading">
      <h2 id="ats-heading" className="text-fg text-[15px] font-semibold">
        ATS review
      </h2>
      <p className="text-muted mt-1 text-sm">How an applicant tracking system will read this. Updates as you type.</p>

      <div className="mt-5 flex items-baseline gap-3">
        <p className="steel-text text-4xl font-semibold tracking-[-0.03em]" aria-describedby="ats-verdict">
          {report.score}
          <span className="text-subtle text-lg">/100</span>
        </p>
        <p id="ats-verdict" className="text-muted text-sm font-medium">
          {scoreVerdict(report.score)}
        </p>
      </div>

      <div className="bg-tint-strong mt-3 h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
        <div
          className="bg-accent-fg/70 h-full rounded-full transition-[width] duration-300"
          style={{ width: `${report.score}%` }}
        />
      </div>

      <p className="text-subtle mt-3 text-xs">
        {todo.length === 0
          ? `Every check passes. ${report.pages === 1 ? "One page" : `${report.pages} pages`}.`
          : `${todo.length} thing${todo.length === 1 ? "" : "s"} left to fix.`}
      </p>

      <ul className="mt-5 space-y-3">
        {report.checks.map((check) => {
          const Icon = ICON[check.status];
          return (
            <li key={check.id} className="flex gap-2.5">
              <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[check.status]}`} aria-hidden />
              <div className="min-w-0">
                <p className="text-fg text-[13px] font-medium">
                  {check.label}
                  <span className="sr-only">
                    {check.status === "pass"
                      ? " — passes"
                      : check.status === "warn"
                        ? " — could be better"
                        : " — missing"}
                  </span>
                </p>
                <p className="text-muted text-xs leading-relaxed">{check.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {report.recognisedSkills.length > 0 && (
        <p className="border-line text-subtle mt-5 border-t pt-4 text-xs">
          Skills we recognise from live postings: {report.recognisedSkills.slice(0, 12).join(", ")}
          {report.recognisedSkills.length > 12 && ` and ${report.recognisedSkills.length - 12} more`}. These are what{" "}
          <span className="text-muted">Matches</span> ranks roles on.
        </p>
      )}
    </section>
  );
}
