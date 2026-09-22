import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { CompanyDirectory } from "@/components/company-directory";
import { Container } from "@/components/ui/container";
import { numberFormat } from "@/lib/format";
import { getCompanies, TAGS } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Companies",
  description: "Top MNCs and startups hiring for tech roles in India.",
  alternates: { canonical: "/companies" },
};

export default async function CompaniesPage() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.companies, TAGS.jobs);

  const companies = await getCompanies();

  return (
    <Container wide className="py-12">
      <h1 className="steel-text text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Companies</h1>
      <p className="mt-2 text-sm text-muted">
        <span className="text-fg tabular-nums">{numberFormat.format(companies.length)}</span> hiring now
      </p>

      {companies.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No companies are hiring right now.</p>
      ) : (
        <CompanyDirectory
          companies={companies.map((c) => ({ slug: c.slug, name: c.name, logoUrl: c.logoUrl, openRoles: c.openRoles }))}
        />
      )}
    </Container>
  );
}
