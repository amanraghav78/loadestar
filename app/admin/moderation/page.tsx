import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Star } from "lucide-react";
import { db } from "@/lib/db";
import { EMPLOYMENT_TYPE_LABEL, formatPostedAgo, formatSalaryBand, LEVEL_LABEL } from "@/lib/format";
import { decideClaim, decideJob, decideReview } from "../actions";
import { DecisionForm } from "./decision-form";

/** One page for everything waiting on a person: claims, listings and reviews. */
export default function ModerationPage() {
  return (
    <Suspense fallback={<p className="text-muted text-sm">Loading…</p>}>
      <Queues />
    </Suspense>
  );
}

async function Queues() {
  await connection();

  const [claims, jobs, reviews] = await Promise.all([
    db.companyMember.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        workEmail: true,
        note: true,
        createdAt: true,
        company: { select: { name: true, slug: true, website: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    db.job.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        level: true,
        employmentType: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        applyUrl: true,
        createdAt: true,
        company: { select: { name: true, slug: true } },
        postedBy: { select: { name: true, email: true } },
      },
    }),
    db.companyReview.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        rating: true,
        title: true,
        pros: true,
        cons: true,
        roleTitle: true,
        stillThere: true,
        createdAt: true,
        company: { select: { name: true, slug: true } },
        user: { select: { email: true } },
      },
    }),
  ]);

  const total = claims.length + jobs.length + reviews.length;

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">
        Moderation <span className="text-muted text-sm font-normal tabular-nums">({total} waiting)</span>
      </h1>

      <Section title="Company claims" count={claims.length}>
        {claims.map((claim) => (
          <Row key={claim.id} when={claim.createdAt}>
            <h3 className="text-fg text-sm font-medium">
              {claim.user.name} wants to post as{" "}
              <Link href={`/companies/${claim.company.slug}`} className="underline underline-offset-4">
                {claim.company.name}
              </Link>
            </h3>
            <dl className="text-muted mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <Pair label="Work email" value={claim.workEmail} />
              <Pair label="Account" value={claim.user.email} />
              <Pair label="Company site" value={new URL(claim.company.website).hostname.replace(/^www\./, "")} />
            </dl>
            {claim.note && <p className="text-muted mt-2 text-xs italic">“{claim.note}”</p>}
            {/* The check: does the work address sit at the company's own domain? */}
            <div className="mt-3">
              <DecisionForm id={claim.id} action={decideClaim} />
            </div>
          </Row>
        ))}
      </Section>

      <Section title="Listings" count={jobs.length}>
        {jobs.map((job) => (
          <Row key={job.id} when={job.createdAt}>
            <h3 className="text-fg text-sm font-medium">{job.title}</h3>
            <p className="text-muted mt-1 text-xs">
              {job.company.name} · {job.location} · {LEVEL_LABEL[job.level]} ·{" "}
              {EMPLOYMENT_TYPE_LABEL[job.employmentType]} ·{" "}
              {formatSalaryBand(job.salaryMin, job.salaryMax, job.currency) ?? "no band"}
            </p>
            <p className="text-subtle mt-1 text-xs">
              by {job.postedBy?.name ?? "unknown"} ({job.postedBy?.email ?? "—"}) ·{" "}
              <a href={job.applyUrl} target="_blank" rel="noopener nofollow" className="underline underline-offset-4">
                apply link
              </a>
            </p>
            <details className="mt-2">
              <summary className="text-muted hover:text-fg cursor-pointer text-xs">Read the description</summary>
              <p className="text-muted mt-2 max-h-72 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap">
                {job.description}
              </p>
            </details>
            <div className="mt-3">
              <DecisionForm id={job.id} action={decideJob} />
            </div>
          </Row>
        ))}
      </Section>

      <Section title="Reviews" count={reviews.length}>
        {reviews.map((review) => (
          <Row key={review.id} when={review.createdAt}>
            <h3 className="text-fg flex items-center gap-2 text-sm font-medium">
              <span className="text-accent-fg flex items-center gap-1" aria-label={`${review.rating} out of 5`}>
                <Star className="size-3.5 fill-current" aria-hidden />
                <span className="tabular-nums">{review.rating}</span>
              </span>
              {review.title}
            </h3>
            <p className="text-muted mt-1 text-xs">
              {review.company.name} · {review.roleTitle ?? "role not given"} ·{" "}
              {review.stillThere ? "current" : "former"} · {review.user.email}
            </p>
            <div className="text-muted mt-2 grid gap-3 text-xs leading-relaxed sm:grid-cols-2">
              <p>
                <span className="text-subtle uppercase">Works: </span>
                {review.pros}
              </p>
              <p>
                <span className="text-subtle uppercase">Doesn&rsquo;t: </span>
                {review.cons}
              </p>
            </div>
            <div className="mt-3">
              <DecisionForm id={review.id} action={decideReview} />
            </div>
          </Row>
        ))}
      </Section>
    </>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-10" aria-labelledby={title}>
      <h2 id={title} className="text-subtle mb-3 text-[11px] font-medium tracking-[0.12em] uppercase">
        {title} <span className="tabular-nums">({count})</span>
      </h2>
      {count === 0 ? (
        <p className="border-line text-muted rounded-xl border border-dashed p-6 text-center text-sm">
          Nothing waiting.
        </p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </section>
  );
}

function Row({ when, children }: { when: Date; children: React.ReactNode }) {
  return (
    <li className="border-line bg-card rounded-xl border p-4">
      {children}
      <p className="text-subtle mt-2 text-[11px]">Submitted {formatPostedAgo(when)}</p>
    </li>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-subtle">{label}:</dt>
      <dd className="text-fg truncate">{value}</dd>
    </div>
  );
}
