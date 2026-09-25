import { AlertTriangle, ArrowRight, Check, FileText } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { authEnabled } from "@/lib/auth";

const POINTS = [
  "A clean one-column layout that tracking systems parse",
  "A live ATS check that says exactly what to fix",
  "Download it as a PDF, ready to send",
];

/**
 * The home page's pitch for the resume builder (app/account/resume). It lives
 * in the account, so without accounts there is nothing to point at. Signed-out
 * visitors who follow the link are sent to sign in and brought back.
 */
export function ResumeBuilderPromo() {
  if (!authEnabled) return null;

  return (
    <Container wide className="pt-20" data-reveal-stagger>
      <section
        aria-labelledby="resume-builder-promo"
        className="metal grid items-center gap-10 overflow-hidden rounded-3xl p-6 sm:p-10 md:grid-cols-[1.05fr_1fr]"
      >
        <div>
          <p className="text-muted inline-flex items-center gap-2 text-xs font-medium">
            <FileText className="text-silver size-3.5" aria-hidden />
            Free resume builder
          </p>
          <h2
            id="resume-builder-promo"
            className="steel-text mt-3 text-2xl font-semibold tracking-[-0.03em] text-balance sm:text-3xl"
          >
            Build a resume an ATS can read
          </h2>
          <p className="text-muted mt-3 max-w-md text-sm leading-relaxed sm:text-[15px]">
            Write it once here, see how an applicant tracking system reads it, and fix what it flags before you apply.
          </p>

          <ul className="mt-6 space-y-2.5">
            {POINTS.map((point) => (
              <li key={point} className="text-fg flex gap-2.5 text-sm">
                <Check className="text-ok mt-0.5 size-4 shrink-0" aria-hidden />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
            <LinkButton href="/account/resume" size="lg" className="group">
              Build your resume
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </LinkButton>
            <p className="text-subtle text-xs">Free. Sign in to start.</p>
          </div>
        </div>

        <ResumeArt />
      </section>
    </Container>
  );
}

/** A resume page with the ATS review beside it: decoration, the words above say it. */
function ResumeArt() {
  return (
    <div
      aria-hidden
      className="border-line bg-surface relative h-72 overflow-hidden rounded-2xl border bg-[radial-gradient(ellipse_75%_70%_at_50%_120%,var(--horizon-surface),transparent_75%)] sm:h-80"
    >
      {/* The page. */}
      <div className="border-line-strong bg-card absolute top-6 bottom-0 left-5 w-[64%] rounded-t-xl border border-b-0 p-4 shadow-[var(--shadow-lift)] sm:left-8 sm:p-5">
        <div className="bg-fg/80 h-2.5 w-28 rounded-full" />
        <div className="bg-tint-strong mt-2 h-1.5 w-36 max-w-full rounded-full" />
        <Section title="Experience" lines={["w-full", "w-11/12", "w-4/5"]} />
        <Section title="Projects" lines={["w-full", "w-3/4"]} />
        <Section title="Skills" lines={["w-5/6"]} />
      </div>

      {/* The review. */}
      <div className="metal absolute right-4 bottom-5 w-44 rounded-2xl p-3.5 sm:right-6 sm:w-48">
        <p className="text-subtle text-[10px] font-medium tracking-[0.14em] uppercase">ATS review</p>
        <p className="steel-text mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          86<span className="text-subtle text-sm">/100</span>
        </p>
        <div className="bg-tint-strong mt-2 h-1 overflow-hidden rounded-full">
          <div className="bg-accent-fg/70 h-full w-[86%] rounded-full" />
        </div>
        <ul className="mt-3 space-y-1.5 text-[11px]">
          <Row ok>Contact details</Row>
          <Row ok>Experience with dates</Row>
          <Row>Bullets carry a number</Row>
        </ul>
      </div>
    </div>
  );
}

function Section({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="mt-4">
      <p className="text-muted border-line border-b pb-1 text-[9px] font-semibold tracking-[0.14em] uppercase">
        {title}
      </p>
      <div className="mt-2 space-y-1.5">
        {lines.map((width, i) => (
          <div key={i} className={`bg-tint-strong h-1.5 rounded-full ${width}`} />
        ))}
      </div>
    </div>
  );
}

function Row({ ok = false, children }: { ok?: boolean; children: string }) {
  const Icon = ok ? Check : AlertTriangle;
  return (
    <li className="text-muted flex items-center gap-1.5">
      <Icon className={`size-3 shrink-0 ${ok ? "text-ok" : "text-accent-fg"}`} />
      {children}
    </li>
  );
}
