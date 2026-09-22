import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getApplications } from "@/lib/account-queries";
import { authEnabled } from "@/lib/auth";
import { formatAge } from "@/lib/format";
import { requireUserPage } from "@/lib/session";
import { CompanyAvatar } from "@/components/company-avatar";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Roles you applied to",
  robots: { index: false, follow: false },
};

export default function ApplicationsPage() {
  if (!authEnabled) notFound();

  return (
    <Container className="py-12">
      <h1 className="steel-text text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Applied</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Roles you opened from Lodestar. You apply on the employer&rsquo;s own site, so check your email there for
        their reply.{" "}
        <Link href="/account" className="underline underline-offset-2">
          Back to your account
        </Link>
      </p>

      <Suspense fallback={<div className="mt-10 h-40 animate-pulse rounded-3xl bg-white/5" />}>
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
      <p className="mt-10 text-sm text-muted">
        Nothing yet.{" "}
        <Link href="/jobs" className="underline underline-offset-2">
          Browse roles
        </Link>
      </p>
    );
  }

  return (
    <ul className="mt-10 grid gap-3 md:grid-cols-2">
      {applications.map(({ job, lastClickedAt }) => (
        <li key={job.slug} className="flex min-w-0">
          <article className="metal-card flex min-w-0 flex-1 items-start gap-3.5 rounded-2xl p-5">
            <CompanyAvatar company={job.company} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-muted">{job.company.name}</p>
              <h2 className="mt-1 line-clamp-2 text-[15px] leading-snug font-semibold text-fg">
                <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
              </h2>
              <p className="mt-2 text-xs text-subtle">
                Opened {formatAge(lastClickedAt)}
                {job.status === "EXPIRED" && " · no longer listed"}
              </p>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
