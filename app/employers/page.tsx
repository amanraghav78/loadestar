import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BadgeCheck, Clock, Plus } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { authEnabled } from "@/lib/auth";
import { EMPLOYMENT_TYPE_LABEL, formatAge, formatJobLocation, formatSalaryBand } from "@/lib/format";
import { getClaimableCompanies, getRecruiterJobs, type RecruiterJob } from "@/lib/recruiter-queries";
import { getRecruiterContext } from "@/lib/recruiter";
import { site } from "@/lib/site";
import { becomeRecruiter } from "./actions";
import { ClaimForm } from "./claim-form";
import { JobStateButtons } from "./job-state-buttons";

export const metadata: Metadata = {
  title: "For employers",
  description: "Post a salary-transparent role and manage your listings on Lodestar.",
  robots: { index: false, follow: false },
};

export default function EmployersPage({ searchParams }: PageProps<"/employers">) {
  if (!authEnabled) notFound();

  return (
    <Container className="py-12">
      <h1 className="steel-text text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Your listings</h1>
      <p className="text-muted mt-2 max-w-xl text-sm">
        Post roles as your company, and keep them accurate. Every listing publishes its salary band and is reviewed by a
        person first.
      </p>

      <Suspense fallback={<div className="bg-tint mt-10 h-64 animate-pulse rounded-3xl" />}>
        {searchParams.then((sp) => (
          <Dashboard
            notice={typeof sp.submitted === "string" ? "submitted" : typeof sp.updated === "string" ? "updated" : null}
          />
        ))}
      </Suspense>
    </Container>
  );
}

async function Dashboard({ notice }: { notice: "submitted" | "updated" | null }) {
  const context = await getRecruiterContext();

  // Signed out: the only thing to show is the way in.
  if (!context) {
    return (
      <div className="metal mt-10 rounded-3xl p-8">
        <h2 className="text-fg text-lg font-semibold">Sign in to post a role</h2>
        <p className="text-muted mt-2 max-w-md text-sm">
          Employer accounts use the same sign-in as candidates. You choose which one you are on the next screen.
        </p>
        <div className="mt-6">
          <GoogleSignIn next="/employers" />
        </div>
      </div>
    );
  }

  // Signed in as a candidate: the role choice, as an explicit action.
  if (!context.isRecruiter) {
    return (
      <div className="metal mt-10 rounded-3xl p-8">
        <h2 className="text-fg text-lg font-semibold">Are you hiring?</h2>
        <p className="text-muted mt-2 max-w-md text-sm">
          You&rsquo;re signed in as a candidate ({context.user.email}). Switch this account to an employer account to
          post roles. Your saved roles stay where they are, and you can still browse as before.
        </p>
        <form action={becomeRecruiter} className="mt-6">
          <button type="submit" className={buttonClass("primary", "md")}>
            Continue as an employer
          </button>
        </form>
        <p className="text-subtle mt-3 text-xs">
          Changing back is a quick word with us at{" "}
          <a href={`mailto:${site.contactEmail}`} className="underline underline-offset-2">
            {site.contactEmail}
          </a>
          .
        </p>
      </div>
    );
  }

  // A recruiter with no approved company: claim one, or wait on the claim.
  if (!context.company) {
    if (context.claim?.status === "PENDING") {
      return (
        <div className="metal mt-10 flex items-start gap-3 rounded-3xl p-8">
          <Clock className="text-accent-fg mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <h2 className="text-fg text-lg font-semibold">Verifying {context.claim.companyName}</h2>
            <p className="text-muted mt-2 max-w-md text-sm">
              We check that you work there before you can post as them — usually within one working day. We&rsquo;ll
              email you when it&rsquo;s done.
            </p>
          </div>
        </div>
      );
    }

    const companies = await getClaimableCompanies();
    return (
      <div className="mt-10 space-y-6">
        {context.claim?.status === "REJECTED" && (
          <div className="border-danger/40 rounded-2xl border p-5">
            <h2 className="text-fg text-sm font-semibold">We couldn&rsquo;t verify {context.claim.companyName}</h2>
            {context.claim.reviewNote && <p className="text-muted mt-1.5 text-sm">{context.claim.reviewNote}</p>}
            <p className="text-muted mt-1.5 text-sm">Fix that and ask again below.</p>
          </div>
        )}
        <div className="metal rounded-3xl p-8">
          <h2 className="text-fg text-lg font-semibold">Which company do you hire for?</h2>
          <p className="text-muted mt-2 mb-6 max-w-md text-sm">
            We verify this once. After that you can post, edit and close your own roles.
          </p>
          <ClaimForm companies={companies} />
        </div>
      </div>
    );
  }

  const jobs = await getRecruiterJobs(context.user.id);

  return (
    <div className="mt-10 space-y-6">
      {notice && (
        <p role="status" className="border-line-strong bg-card text-muted rounded-2xl border px-5 py-3 text-sm">
          {notice === "submitted"
            ? "Thanks — your role is with us for review. We'll email you when it's live."
            : "Saved. Your changes go back to us for review before they're live."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted flex items-center gap-1.5 text-sm">
          <BadgeCheck className="text-ok size-4" aria-hidden />
          Verified for <span className="text-fg font-medium">{context.company.name}</span>
        </p>
        <Link href="/employers/post" className={buttonClass("primary", "sm", "ml-auto")}>
          <Plus className="size-4" aria-hidden /> Post a role
        </Link>
      </div>

      {jobs.length === 0 ? (
        <p className="border-line text-muted rounded-2xl border border-dashed p-10 text-center text-sm">
          No listings yet.{" "}
          <Link href="/employers/post" className="text-fg underline underline-offset-4">
            Post your first role
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobRow job={job} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JobRow({ job }: { job: RecruiterJob }) {
  const band = formatSalaryBand(job.salaryMin, job.salaryMax, job.currency);

  return (
    <article className="metal rounded-2xl p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-fg text-[15px] font-semibold">
            {job.status === "ACTIVE" ? (
              <Link href={`/jobs/${job.slug}`} className="hover:underline">
                {job.title}
              </Link>
            ) : (
              job.title
            )}
          </h3>
          <p className="text-muted mt-1 text-xs">
            {formatJobLocation(job)} · {EMPLOYMENT_TYPE_LABEL[job.employmentType]}
            {band && ` · ${band}`}
          </p>
        </div>
        <StatusPill status={job.status} />
      </div>

      {job.status === "REJECTED" && job.moderationNote && (
        <p className="border-danger/40 text-muted mt-3 rounded-lg border px-3 py-2 text-xs">
          <span className="text-fg font-medium">Not published: </span>
          {job.moderationNote}
        </p>
      )}

      <div className="text-subtle mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="tabular-nums">
          {job._count.applyClicks} {job._count.applyClicks === 1 ? "apply click" : "apply clicks"}
        </span>
        <span className="tabular-nums">
          {job._count.applications} {job._count.applications === 1 ? "candidate applied" : "candidates applied"}
        </span>
        {job.status === "ACTIVE" && <span>Confirmed {formatAge(job.lastVerifiedAt)} ago</span>}
        <span className="ml-auto flex items-center gap-3">
          <Link href={`/employers/jobs/${job.id}`} className="text-muted hover:text-fg">
            Edit
          </Link>
          <JobStateButtons id={job.id} status={job.status} />
        </span>
      </div>
    </article>
  );
}

const STATUS_TEXT = {
  ACTIVE: { label: "Live", className: "text-ok" },
  PENDING: { label: "In review", className: "text-accent-fg" },
  REJECTED: { label: "Not published", className: "text-danger" },
  CLOSED: { label: "Closed", className: "text-subtle" },
  EXPIRED: { label: "Expired", className: "text-subtle" },
} as const;

function StatusPill({ status }: { status: keyof typeof STATUS_TEXT }) {
  const { label, className } = STATUS_TEXT[status];
  return <span className={`shrink-0 text-xs font-medium ${className}`}>{label}</span>;
}
