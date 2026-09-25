import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { authEnabled } from "@/lib/auth";
import { readResume } from "@/lib/resume-document";
import { requireUserPage } from "@/lib/session";
import { resumeUploadEnabled } from "@/lib/storage";
import { Container } from "@/components/ui/container";
import { AccountTabs } from "../account-tabs";
import { ResumeBuilder } from "./resume-builder";

export const metadata: Metadata = {
  title: "Build your resume",
  robots: { index: false, follow: false },
};

export default function ResumeBuilderPage() {
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
        .
      </p>

      {/* Reads the session, so it streams in behind the boundary. */}
      <Suspense fallback={<div className="bg-tint mt-10 h-[32rem] animate-pulse rounded-3xl" />}>
        <Builder />
      </Suspense>
    </Container>
  );
}

async function Builder() {
  const user = await requireUserPage("/account/resume");
  const { content, contact, updatedAt } = await readResume(user.id, user.name, user.email);

  return (
    <ResumeBuilder
      initial={content}
      contact={contact}
      savedAt={updatedAt?.toISOString() ?? null}
      storageEnabled={resumeUploadEnabled}
    />
  );
}
