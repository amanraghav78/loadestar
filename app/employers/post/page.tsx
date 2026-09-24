import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { authEnabled } from "@/lib/auth";
import { getRecruiterContext } from "@/lib/recruiter";
import { RecruiterJobForm } from "../recruiter-job-form";

export const metadata: Metadata = {
  title: "Post a role",
  description: "Post a salary-transparent role to Lodestar.",
  alternates: { canonical: "/employers/post" },
};

export default function PostRolePage() {
  if (!authEnabled) notFound();

  return (
    <Container className="py-12">
      <h1 className="steel-text text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Post a role</h1>
      <p className="text-muted mt-2 max-w-xl text-sm">
        Publish the band, say where to apply, and we&rsquo;ll review it — usually within a working day. Read our{" "}
        <Link href="/editorial-standards" className="underline underline-offset-2">
          editorial standards
        </Link>{" "}
        first.
      </p>

      <Suspense fallback={<div className="bg-tint mt-10 h-96 animate-pulse rounded-3xl" />}>
        <PostForm />
      </Suspense>
    </Container>
  );
}

/**
 * Everything about who may post lives in /employers, so an unverified recruiter
 * is sent there rather than being shown a second copy of the gate.
 */
async function PostForm() {
  const context = await getRecruiterContext();
  if (!context?.company) redirect("/employers");

  return (
    <div className="metal mt-10 rounded-3xl p-6 sm:p-8">
      <RecruiterJobForm companyName={context.company.name} />
    </div>
  );
}
