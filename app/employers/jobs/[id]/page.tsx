import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/container";
import { authEnabled } from "@/lib/auth";
import { getRecruiterContext } from "@/lib/recruiter";
import { getRecruiterJob } from "@/lib/recruiter-queries";
import { RecruiterJobForm } from "../../recruiter-job-form";

export const metadata: Metadata = {
  title: "Edit your role",
  robots: { index: false, follow: false },
};

export default function EditRolePage({ params }: PageProps<"/employers/jobs/[id]">) {
  if (!authEnabled) notFound();

  return (
    <Container className="py-12">
      <Link href="/employers" className="text-muted hover:text-fg inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> Your listings
      </Link>

      <Suspense fallback={<div className="bg-tint mt-8 h-96 animate-pulse rounded-3xl" />}>
        {params.then(({ id }) => (
          <EditForm id={id} />
        ))}
      </Suspense>
    </Container>
  );
}

async function EditForm({ id }: { id: string }) {
  const context = await getRecruiterContext();
  if (!context?.company) redirect("/employers");

  // Scoped to this recruiter, so another company's id is simply not found.
  const job = await getRecruiterJob(id, context.user.id);
  if (!job) notFound();

  return (
    <>
      <h1 className="steel-text mt-6 text-3xl font-semibold tracking-[-0.03em]">Edit your role</h1>
      {job.status === "REJECTED" && job.moderationNote && (
        <p className="border-danger/40 text-muted mt-4 max-w-xl rounded-2xl border p-4 text-sm">
          <span className="text-fg font-medium">We didn&rsquo;t publish this: </span>
          {job.moderationNote}
        </p>
      )}

      <div className="metal mt-8 rounded-3xl p-6 sm:p-8">
        <RecruiterJobForm
          companyName={context.company.name}
          job={{
            id: job.id,
            title: job.title,
            description: job.description,
            discipline: job.discipline,
            level: job.level,
            employmentType: job.employmentType,
            tags: job.tags,
            location: job.location,
            remote: job.remote,
            remoteRegion: job.remoteRegion,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            currency: job.currency,
            applyUrl: job.applyUrl,
          }}
        />
      </div>
    </>
  );
}
