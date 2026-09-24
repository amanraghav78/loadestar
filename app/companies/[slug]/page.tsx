import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";
import { ArrowLeft, Globe, MapPin, Users } from "lucide-react";
import { CompanyAvatar } from "@/components/company-avatar";
import { JobCardSkeleton, JobList } from "@/components/job-card";
import { Container } from "@/components/ui/container";
import { numberFormat } from "@/lib/format";
import { getCompanyBySlug, TAGS } from "@/lib/queries";
import { ReviewsSection } from "./reviews-section";

export async function generateMetadata({ params }: PageProps<"/companies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  return {
    title: `${company.name} jobs in India`,
    description: `${company.jobs.length} open tech jobs at ${company.name} in India.`,
    alternates: { canonical: `/companies/${company.slug}` },
  };
}

export default function CompanyPage({ params }: PageProps<"/companies/[slug]">) {
  return (
    <Container wide className="py-8">
      <Link
        href="/companies"
        className="text-muted hover:text-fg inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> All companies
      </Link>
      <Suspense
        fallback={
          <div className="mt-8 grid gap-3 md:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <JobCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        {params.then(({ slug }) => (
          <>
            <CompanyDetail slug={slug} />
            {/*
             * Reviews sit outside CompanyDetail because part of them is
             * per-person ("your review"), which must never be written to the
             * shared cache that CompanyDetail renders into.
             */}
            <Suspense fallback={<div className="bg-tint mt-12 h-64 animate-pulse rounded-3xl" />}>
              <CompanyReviews slug={slug} />
            </Suspense>
          </>
        ))}
      </Suspense>
    </Container>
  );
}

/** Uncached on purpose: ReviewsSection reads the session. */
async function CompanyReviews({ slug }: { slug: string }) {
  const company = await getCompanyBySlug(slug);
  if (!company) return null;
  return <ReviewsSection companyId={company.id} slug={slug} companyName={company.name} />;
}

async function CompanyDetail({ slug }: { slug: string }) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.companies, TAGS.company(slug), TAGS.jobs);

  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const count = company.jobs.length;

  return (
    <>
      <header className="metal relative isolate mt-6 overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="hero-grid opacity-60" aria-hidden />
        <div className="flex flex-wrap items-center gap-5">
          <CompanyAvatar company={company} size="lg" />
          <div className="min-w-0">
            <h1 className="steel-text pb-1 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{company.name}</h1>
            <ul className="text-muted mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <li className="text-fg">
                <span className="tabular-nums">{numberFormat.format(count)}</span> open {count === 1 ? "job" : "jobs"}
              </li>
              {company.hq && (
                <li className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden /> {company.hq}
                </li>
              )}
              {company.size && (
                <li className="flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden /> {company.size}
                </li>
              )}
              <li>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener"
                  className="hover:text-fg flex items-center gap-1.5 transition-colors"
                >
                  <Globe className="size-3.5" aria-hidden />
                  {new URL(company.website).hostname.replace(/^www\./, "")}
                </a>
              </li>
            </ul>
          </div>
        </div>
        {company.description && (
          <p className="text-muted mt-6 max-w-2xl text-[15px] leading-relaxed">{company.description}</p>
        )}
      </header>

      <section className="mt-10" aria-labelledby="open-roles">
        <h2 id="open-roles" className="sr-only">
          Open jobs
        </h2>
        {count > 0 ? (
          <JobList jobs={company.jobs} />
        ) : (
          <p className="border-line text-muted rounded-2xl border border-dashed p-10 text-center text-sm">
            {company.name} has no open jobs right now.
          </p>
        )}
      </section>
    </>
  );
}
