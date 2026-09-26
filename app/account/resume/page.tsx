import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { descriptionToPlainText } from "@/components/job-description";
import { authEnabled } from "@/lib/auth";
import { isListingPublic } from "@/lib/listing-age";
import { getJobBySlug } from "@/lib/queries";
import { readResume } from "@/lib/resume-document";
import type { JobForTailoring } from "@/lib/resume-tailor";
import { requireUserPage } from "@/lib/session";
import { resumeUploadEnabled } from "@/lib/storage";
import { Container } from "@/components/ui/container";
import { AccountTabs } from "../account-tabs";
import { ResumeBuilder } from "./resume-builder";

export const metadata: Metadata = {
  title: "Build your resume",
  robots: { index: false, follow: false },
};

export default function ResumeBuilderPage({ searchParams }: PageProps<"/account/resume">) {
  if (!authEnabled) notFound();

  return (
    <Container wide className="py-10">
      <AccountTabs current="/account/resume" />
      <h1 className="steel-text text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Build your resume</h1>
      <p className="text-muted mt-2 max-w-2xl text-sm">
        One column, real text, headings a parser recognises &mdash; the shape that survives an applicant tracking
        system. Your name, phone and links come from{" "}
        <Link href="/account" className="underline underline-offset-2">
          your profile
        </Link>
        . Changes save as you type.
      </p>

      {/* Reads the session, so it streams in behind the boundary. */}
      <Suspense fallback={<div className="bg-tint mt-10 h-[32rem] animate-pulse rounded-3xl" />}>
        <Builder searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Builder({ searchParams }: Pick<PageProps<"/account/resume">, "searchParams">) {
  const { job: slug } = await searchParams;
  const path = typeof slug === "string" ? `/account/resume?job=${encodeURIComponent(slug)}` : "/account/resume";
  const user = await requireUserPage(path);
  const [{ content, contact, updatedAt, uploadedFilename }, job] = await Promise.all([
    readResume(user.id, user.name, user.email),
    typeof slug === "string" ? tailoringTarget(slug) : null,
  ]);

  return (
    <ResumeBuilder
      initial={content}
      contact={contact}
      savedAt={updatedAt?.toISOString() ?? null}
      storageEnabled={resumeUploadEnabled}
      uploadedFilename={uploadedFilename}
      job={job}
    />
  );
}

/** The job named in `?job=`, when it is one we list. A stale or mistyped slug just means no tailoring. */
async function tailoringTarget(slug: string): Promise<JobForTailoring | null> {
  if (!/^[\w-]{1,200}$/.test(slug)) return null;
  const job = await getJobBySlug(slug);
  if (!job || !isListingPublic(job.status)) return null;
  return {
    slug: job.slug,
    title: job.title,
    companyName: job.company.name,
    tags: job.tags,
    description: descriptionToPlainText(job.description, 20_000),
  };
}
