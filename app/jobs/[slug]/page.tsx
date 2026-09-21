import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";
import { ArrowLeft, ArrowUpRight, Building2, Clock, Globe, MapPin, Users } from "lucide-react";
import { CompanyAvatar } from "@/components/company-avatar";
import { descriptionToPlainText, JobDescription } from "@/components/job-description";
import { JobGrid } from "@/components/job-card";
import { SaveButton } from "@/components/save-button";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Tag } from "@/components/ui/tag";
import {
  DISCIPLINE_LABEL,
  formatJobLocation,
  formatPostedAgo,
  formatSalaryBand,
  LEVEL_LABEL,
  REMOTE_LABEL,
} from "@/lib/format";
import { getJobBySlug, getSimilarJobs, TAGS } from "@/lib/queries";
import { absoluteUrl, site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/jobs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const band = formatSalaryBand(job.salaryMin, job.salaryMax, job.currency);
  const lead = [band, formatJobLocation(job)].filter(Boolean).join(" · ");
  return {
    title: `${job.title} at ${job.company.name}`,
    description: `${lead}. ${descriptionToPlainText(job.description, 120)}`,
    alternates: { canonical: `/jobs/${job.slug}` },
    robots: job.status === "ACTIVE" ? undefined : { index: false },
    openGraph: { title: `${job.title} at ${job.company.name}${band ? ` — ${band}` : ""}`, url: `/jobs/${job.slug}` },
  };
}

export default function JobPage({ params }: PageProps<"/jobs/[slug]">) {
  return (
    <Container className="py-8">
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" aria-hidden /> All roles
      </Link>
      <Suspense fallback={<JobSkeleton />}>
        {params.then(({ slug }) => (
          <JobDetail slug={slug} />
        ))}
      </Suspense>
    </Container>
  );
}

async function JobDetail({ slug }: { slug: string }) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.jobs, TAGS.job(slug));

  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const active = job.status === "ACTIVE";
  const similar = await getSimilarJobs(job.id, job.discipline);

  return (
    <>
      <script
        type="application/ld+json"
        // "<" is escaped so the JSON cannot close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd(job)).replace(/</g, "\\u003c") }}
      />

      {!active && (
        <p role="status" className="mt-6 rounded-lg border border-line-strong bg-card px-4 py-3 text-sm text-muted">
          This role is no longer open. It was taken down because it disappeared from {job.company.name}&rsquo;s
          careers page.
        </p>
      )}

      <div className="mt-6 grid gap-10 md:grid-cols-[1fr_16rem]">
        <article className="min-w-0">
          <header className="flex items-start gap-4">
            <CompanyAvatar name={job.company.name} logoUrl={job.company.logoUrl} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight metal-text">{job.title}</h1>
              <p className="mt-1 text-sm text-muted">
                <Link href={`/companies/${job.company.slug}`} className="text-fg hover:underline">
                  {job.company.name}
                </Link>{" "}
                · {formatJobLocation(job)}
              </p>
            </div>
          </header>

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            {[
              ["Salary", formatSalaryBand(job.salaryMin, job.salaryMax, job.currency) ?? "Not disclosed"],
              ["Level", LEVEL_LABEL[job.level]],
              ["Setup", REMOTE_LABEL[job.remote]],
              ["Posted", formatPostedAgo(job.postedAt)],
            ].map(([k, v]) => (
              <div key={k} className="bg-card px-4 py-3">
                <dt className="text-[11px] tracking-wide text-subtle uppercase">{k}</dt>
                <dd className="mt-1 text-sm font-medium text-fg tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
            <li>
              <Tag>{DISCIPLINE_LABEL[job.discipline]}</Tag>
            </li>
            {job.tags.map((t) => (
              <li key={t}>
                <Tag>{t}</Tag>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-2">
            {active && (
              <a
                href={`/apply/${job.id}`}
                target="_blank"
                rel="noopener nofollow"
                className={buttonClass("primary", "md")}
              >
                Apply on {job.company.name}&rsquo;s site <ArrowUpRight className="size-4" aria-hidden />
              </a>
            )}
            <SaveButton jobId={job.id} jobTitle={job.title} variant="full" />
          </div>

          <div className="mt-10 border-t border-line pt-8">
            <JobDescription text={job.description} />
          </div>
        </article>

        <aside className="space-y-4 md:sticky md:top-20 md:self-start">
          <section className="metal-panel rounded-xl p-4" aria-labelledby="about-company">
            <h2 id="about-company" className="text-sm font-semibold text-fg">
              About {job.company.name}
            </h2>
            {job.company.description && (
              <p className="mt-2 text-sm leading-relaxed text-muted">{job.company.description}</p>
            )}
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {job.company.hq && (
                <li className="flex items-center gap-2">
                  <MapPin className="size-3.5" aria-hidden /> {job.company.hq}
                </li>
              )}
              {job.company.size && (
                <li className="flex items-center gap-2">
                  <Users className="size-3.5" aria-hidden /> {job.company.size} people
                </li>
              )}
              {job.company.medianResponseDays != null && (
                <li className="flex items-center gap-2">
                  <Clock className="size-3.5" aria-hidden /> Replies in ~{job.company.medianResponseDays} days
                </li>
              )}
              <li className="flex items-center gap-2">
                <Globe className="size-3.5" aria-hidden />
                <a href={job.company.website} target="_blank" rel="noopener" className="hover:text-fg">
                  {new URL(job.company.website).hostname.replace(/^www\./, "")}
                </a>
              </li>
            </ul>
            <Link
              href={`/companies/${job.company.slug}`}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"
            >
              <Building2 className="size-3.5" aria-hidden /> All roles at {job.company.name}
            </Link>
          </section>
          <p className="px-1 text-xs leading-relaxed text-subtle">
            {job.source === "MANUAL"
              ? `Last confirmed by the employer ${formatPostedAgo(job.lastVerifiedAt).toLowerCase()}.`
              : `Taken from ${job.company.name}’s careers page, last checked ${formatPostedAgo(job.lastVerifiedAt).toLowerCase()}.`}{" "}
            Applications go directly to {job.company.name}; Lodestar never sees your details.
          </p>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16" aria-labelledby="similar">
          <h2 id="similar" className="mb-4 text-lg font-semibold text-fg">
            Similar {DISCIPLINE_LABEL[job.discipline].toLowerCase()} roles
          </h2>
          <JobGrid jobs={similar} />
        </section>
      )}
    </>
  );
}

type JobForLd = NonNullable<Awaited<ReturnType<typeof getJobBySlug>>>;

function jobPostingJsonLd(job: JobForLd) {
  const validThrough = new Date(job.lastVerifiedAt.getTime() + site.expiryDays * 24 * 60 * 60 * 1000);
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.postedAt.toISOString(),
    validThrough: validThrough.toISOString(),
    employmentType: "FULL_TIME",
    url: absoluteUrl(`/jobs/${job.slug}`),
    directApply: false,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      sameAs: job.company.website,
      ...(job.company.logoUrl ? { logo: job.company.logoUrl } : {}),
    },
    ...(job.remote === "REMOTE"
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "Country", name: "India" },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: job.location.split(" · ")[0], addressCountry: "IN" },
          },
        }),
    // Only when the employer published pay; Google treats a guessed salary as spam.
    ...(job.salaryDisclosed && job.currency
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: job.currency,
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salaryMin,
              maxValue: job.salaryMax,
              unitText: "YEAR",
            },
          },
        }
      : {}),
  };
}

function JobSkeleton() {
  return (
    <div className="mt-6 animate-pulse" aria-busy="true" aria-label="Loading role">
      <div className="flex gap-4">
        <div className="size-12 rounded-md bg-card" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-2/3 rounded bg-card" />
          <div className="h-4 w-1/3 rounded bg-card" />
        </div>
      </div>
      <div className="mt-6 h-16 rounded-xl bg-card" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-4 rounded bg-card" />
        ))}
      </div>
    </div>
  );
}
