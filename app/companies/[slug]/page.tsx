import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";
import { ArrowLeft, Clock, Globe, MapPin, Users } from "lucide-react";
import { CompanyAvatar } from "@/components/company-avatar";
import { JobCardSkeleton, JobGrid } from "@/components/job-card";
import { Container } from "@/components/ui/container";
import { getCompanyBySlug, TAGS } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/companies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  return {
    title: `${company.name} jobs & salaries`,
    description: `${company.jobs.length} open roles at ${company.name} in India.`,
    alternates: { canonical: `/companies/${company.slug}` },
  };
}

export default function CompanyPage({ params }: PageProps<"/companies/[slug]">) {
  return (
    <Container className="py-8">
      <Link href="/companies" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" aria-hidden /> All companies
      </Link>
      <Suspense
        fallback={
          <div className="mt-8 grid gap-3 sm:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <JobCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        {params.then(({ slug }) => (
          <CompanyDetail slug={slug} />
        ))}
      </Suspense>
    </Container>
  );
}

async function CompanyDetail({ slug }: { slug: string }) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.companies, TAGS.company(slug), TAGS.jobs);

  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  return (
    <>
      <header className="mt-6 flex items-start gap-4">
        <CompanyAvatar name={company.name} logoUrl={company.logoUrl} size="lg" />
        <div>
          <h1 className="metal-text text-2xl font-semibold tracking-tight">{company.name}</h1>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {company.hq && (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden /> {company.hq}
              </li>
            )}
            {company.size && (
              <li className="flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden /> {company.size} people
              </li>
            )}
            {company.medianResponseDays != null && (
              <li className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden /> Median reply in {company.medianResponseDays} days
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <Globe className="size-3.5" aria-hidden />
              <a href={company.website} target="_blank" rel="noopener" className="hover:text-fg">
                {new URL(company.website).hostname.replace(/^www\./, "")}
              </a>
            </li>
          </ul>
        </div>
      </header>
      {company.description && (
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted">{company.description}</p>
      )}

      <section className="mt-12" aria-labelledby="open-roles">
        <h2 id="open-roles" className="mb-4 text-lg font-semibold">
          {company.jobs.length} open {company.jobs.length === 1 ? "role" : "roles"}
        </h2>
        {company.jobs.length > 0 ? (
          <JobGrid jobs={company.jobs} />
        ) : (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            {company.name} has no open roles right now.
          </p>
        )}
      </section>
    </>
  );
}
