import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getApplications } from "@/lib/account-queries";
import { authEnabled } from "@/lib/auth";
import { APPLICATION_STAGE_LABEL, formatAge } from "@/lib/format";
import { requireUserPage } from "@/lib/session";
import { ListChecks } from "lucide-react";
import { CompanyAvatar } from "@/components/company-avatar";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountTabs } from "../account-tabs";
import { StagePicker } from "./stage-picker";

export const metadata: Metadata = {
  title: "Roles you applied to",
  robots: { index: false, follow: false },
};

export default function ApplicationsPage() {
  if (!authEnabled) notFound();

  return (
    <Container className="py-10">
      <AccountTabs current="/account/applications" />
      <h1 className="steel-text text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Applied</h1>
      <p className="text-muted mt-2 max-w-xl text-sm">
        Roles you opened from Lodestar. You apply on the employer&rsquo;s own site, so we never hear their decision
        &mdash; move a role along yourself to keep track of where it got to.
      </p>

      <Suspense fallback={<div className="bg-tint mt-10 h-40 animate-pulse rounded-3xl" />}>
        <AppliedList />
      </Suspense>
    </Container>
  );
}

async function AppliedList() {
  await requireUserPage("/account/applications");
  const applications = await getApplications();

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No applications yet"
        action={
          <>
            <Link href="/jobs" className={buttonClass("primary", "md")}>
              Browse jobs
            </Link>
            <Link href="/account/resume" className={buttonClass("secondary", "md")}>
              Build your resume
            </Link>
          </>
        }
        className="mt-10"
      >
        When you press Apply on a role, it lands here so you can track where it got to.
      </EmptyState>
    );
  }

  return (
    <ul className="mt-10 grid gap-3">
      {applications.map(({ job, jobId, lastClickedAt, stage, note }) => (
        <li key={job.slug} className="flex min-w-0">
          <article className="metal-card flex min-w-0 flex-1 items-start gap-3.5 rounded-2xl p-5">
            <CompanyAvatar company={job.company} />
            <div className="min-w-0 flex-1">
              <p className="text-muted truncate text-xs font-medium">{job.company.name}</p>
              <h2 className="text-fg mt-1 line-clamp-2 text-[15px] leading-snug font-semibold">
                <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
              </h2>
              <p className="text-subtle mt-2 text-xs">
                Opened {formatAge(lastClickedAt)}
                {job.status !== "ACTIVE" && " · no longer listed"}
                {stage !== "APPLIED" && ` · ${APPLICATION_STAGE_LABEL[stage]}`}
              </p>
              <StagePicker jobId={jobId} stage={stage} note={note} />
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
