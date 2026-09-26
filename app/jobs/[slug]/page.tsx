import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  FileText,
  Globe,
  History,
  Laptop,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { CompanyAvatar } from "@/components/company-avatar";
import { descriptionToPlainText, JobDescription } from "@/components/job-description";
import { JobGrid, SalaryPill } from "@/components/job-card";
import { SaveButton } from "@/components/save-button";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Tag } from "@/components/ui/tag";
import {
  DISCIPLINE_LABEL,
  formatJobLocation,
  formatPostedAgo,
  formatSalaryBand,
  EMPLOYMENT_TYPE_LABEL,
  LEVEL_LABEL,
  REMOTE_LABEL,
} from "@/lib/format";
import { authEnabled } from "@/lib/auth";
import { formatExperience } from "@/lib/experience";
import { getJobBySlug, getSimilarJobs, TAGS } from "@/lib/queries";
import { isListingPublic, listingExpiresAt } from "@/lib/listing-age";
import { companyLogo } from "@/lib/logos";
import { absoluteUrl } from "@/lib/site";
import { experienceRequirementsJsonLd, jsonLdScript } from "@/lib/structured-data";

export async function generateMetadata({ params }: PageProps<"/jobs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job || !isListingPublic(job.status)) notFound();

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
    <Container wide className="py-8">
      <Link
        href="/jobs"
        className="text-muted hover:text-fg inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> All jobs
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
  if (!job || !isListingPublic(job.status)) notFound();

  const active = job.status === "ACTIVE";
  const similar = await getSimilarJobs(job.id, job.discipline);
  const band = formatSalaryBand(job.salaryMin, job.salaryMax, job.currency);
  const years = formatExperience(job.experienceMin, job.experienceMax);
  const applyProps = { href: `/apply/${job.id}`, target: "_blank", rel: "noopener nofollow" } as const;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jobPostingJsonLd(job)) }} />

      {!active && (
        <p role="status" className="metal text-muted mt-6 rounded-2xl px-5 py-4 text-sm">
          This job is no longer accepting applications.
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <article className="min-w-0">
          <header className="metal relative isolate overflow-hidden rounded-3xl p-6 sm:p-8">
            <div className="hero-grid opacity-60" aria-hidden />
            <div className="flex items-center gap-3">
              <CompanyAvatar company={job.company} size="lg" />
              <Link
                href={`/companies/${job.company.slug}`}
                className="text-muted hover:text-fg text-sm font-medium transition-colors"
              >
                {job.company.name}
              </Link>
            </div>
            <h1 className="steel-text mt-5 pb-1 text-3xl leading-tight font-semibold tracking-[-0.03em] sm:text-4xl">
              {job.title}
            </h1>

            <ul className="text-muted mt-5 flex flex-wrap items-center gap-2 text-sm" aria-label="Details">
              {band && (
                <li>
                  <SalaryPill band={band} large />
                </li>
              )}
              <Fact icon={MapPin}>{job.location}</Fact>
              {job.remote !== "ONSITE" && <Fact icon={Laptop}>{REMOTE_LABEL[job.remote]}</Fact>}
              <Fact icon={BriefcaseBusiness}>{LEVEL_LABEL[job.level]}</Fact>
              {years && (
                <Fact icon={History}>
                  <span className="sr-only">Experience:</span>
                  {years}
                </Fact>
              )}
              {job.employmentType !== "FULL_TIME" && (
                <Fact icon={Clock}>{EMPLOYMENT_TYPE_LABEL[job.employmentType]}</Fact>
              )}
              <Fact icon={CalendarDays}>{formatPostedAgo(job.postedAt)}</Fact>
            </ul>

            {/* Tablets. Desktops get the sticky apply card in the sidebar, phones the bottom bar. */}
            {active && (
              <div className="mt-7 hidden flex-wrap gap-2 sm:flex lg:hidden">
                <a {...applyProps} className={buttonClass("primary", "lg")}>
                  Apply now <ArrowUpRight className="size-4" aria-hidden />
                </a>
                <SaveButton jobId={job.id} jobTitle={job.title} variant="full" />
              </div>
            )}
          </header>

          {job.tags.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-1.5" aria-label="Skills">
              <li>
                <Tag>{DISCIPLINE_LABEL[job.discipline]}</Tag>
              </li>
              {job.tags.map((t) => (
                <li key={t}>
                  <Tag>{t}</Tag>
                </li>
              ))}
            </ul>
          )}

          <section className="mt-8" aria-labelledby="about-role">
            <h2 id="about-role" className="text-fg mb-4 text-lg font-semibold">
              About the role
            </h2>
            <JobDescription text={job.description} />
          </section>
        </article>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          {/* Stays in view on desktop, so a long description never hides Apply. */}
          {active && (
            <section className="metal hidden rounded-3xl p-5 lg:block" aria-label="Apply">
              <p className="text-subtle text-xs font-medium">Salary</p>
              {band ? (
                <p className="text-fg mt-1 text-xl font-semibold tracking-tight tabular-nums">{band}</p>
              ) : (
                <p className="text-muted mt-1 text-sm">Not disclosed</p>
              )}
              <a {...applyProps} className={buttonClass("primary", "lg", "mt-5 w-full")}>
                Apply now <ArrowUpRight className="size-4" aria-hidden />
              </a>
              <SaveButton jobId={job.id} jobTitle={job.title} variant="full" className="mt-2 w-full" />
              <p className="text-subtle mt-3 text-center text-xs">You apply on {job.company.name}&apos;s own site.</p>
              {authEnabled && (
                <Link
                  href={`/account/resume?job=${encodeURIComponent(job.slug)}`}
                  className="group border-line text-muted hover:text-fg mt-4 flex items-center justify-center gap-1.5 border-t pt-4 text-xs transition-colors"
                >
                  <FileText className="size-3.5" aria-hidden />
                  <span className="text-fg font-medium">Tailor my resume for this role</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              )}
            </section>
          )}
          {/* Below desktop the apply card is hidden, so the nudge gets a card of its own. */}
          {active && authEnabled && (
            <section className="metal flex items-start gap-3 rounded-3xl p-5 lg:hidden" aria-labelledby="need-resume">
              <span className="metal flex size-9 shrink-0 items-center justify-center rounded-xl" aria-hidden>
                <FileText className="text-muted size-4" />
              </span>
              <div className="min-w-0">
                <h2 id="need-resume" className="text-fg text-[15px] font-semibold">
                  Tailor your resume
                </h2>
                <p className="text-muted mt-1 text-sm">
                  See which of this role&apos;s skills your resume is missing, then download it as a PDF an ATS can
                  read. Free.
                </p>
                <Link
                  href={`/account/resume?job=${encodeURIComponent(job.slug)}`}
                  className="group text-fg mt-3 inline-flex items-center gap-1 text-sm font-medium"
                >
                  Tailor my resume for this role
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            </section>
          )}
          <section className="metal rounded-3xl p-5" aria-labelledby="about-company">
            <div className="flex items-center gap-3">
              <CompanyAvatar company={job.company} />
              <h2 id="about-company" className="text-fg min-w-0 truncate text-[15px] font-semibold">
                {job.company.name}
              </h2>
            </div>
            {job.company.description && (
              <p className="text-muted mt-3 line-clamp-4 text-sm leading-relaxed">{job.company.description}</p>
            )}
            <a
              href={job.company.website}
              target="_blank"
              rel="noopener"
              className="text-muted hover:text-fg mt-4 flex items-center gap-2 text-sm transition-colors"
            >
              <Globe className="size-3.5" aria-hidden />
              {new URL(job.company.website).hostname.replace(/^www\./, "")}
            </a>
            <Link href={`/companies/${job.company.slug}`} className={buttonClass("secondary", "md", "mt-5 w-full")}>
              More jobs at {job.company.name}
            </Link>
          </section>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16" aria-labelledby="similar">
          <h2 id="similar" className="steel-text mb-5 text-xl font-semibold tracking-tight">
            Similar jobs
          </h2>
          <JobGrid jobs={similar.slice(0, 3)} />
        </section>
      )}

      {active && (
        <>
          {/* Phones get a sticky apply bar instead of the header buttons. */}
          <div className="border-line bg-bg/85 fixed inset-x-0 bottom-0 z-40 border-t p-3 backdrop-blur-xl sm:hidden">
            <div className="flex gap-2">
              <a {...applyProps} className={buttonClass("primary", "lg", "flex-1")}>
                Apply now <ArrowUpRight className="size-4" aria-hidden />
              </a>
              <SaveButton jobId={job.id} jobTitle={job.title} variant="full" />
            </div>
          </div>
          <div className="h-20 sm:hidden" aria-hidden />
        </>
      )}
    </>
  );
}

function Fact({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="border-line bg-surface/60 inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
      <Icon className="text-subtle size-3.5" aria-hidden />
      {children}
    </li>
  );
}

type JobForLd = NonNullable<Awaited<ReturnType<typeof getJobBySlug>>>;

function jobPostingJsonLd(job: JobForLd) {
  const validThrough = listingExpiresAt(job.postedAt);
  const logo = companyLogo(job.company);
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.postedAt.toISOString(),
    validThrough: validThrough.toISOString(),
    employmentType: job.employmentType,
    url: absoluteUrl(`/jobs/${job.slug}`),
    directApply: false,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      sameAs: job.company.website,
      ...(logo ? { logo: absoluteUrl(logo) } : {}),
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
    // Only when the posting states the years; the level fallback is a guess.
    ...experienceRequirementsJsonLd(job.experienceMin),
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
    <div className="mt-6 animate-pulse" aria-busy="true" aria-label="Loading job">
      <div className="border-line bg-card h-64 rounded-3xl border" />
      <div className="mt-10 max-w-3xl space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-card h-4 rounded" />
        ))}
      </div>
    </div>
  );
}
