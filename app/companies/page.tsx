import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { Clock } from "lucide-react";
import { CompanyAvatar } from "@/components/company-avatar";
import { Container } from "@/components/ui/container";
import { getCompanies, TAGS } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Companies",
  description: "Companies hiring on Lodestar. Every one publishes salary bands on every listing.",
  alternates: { canonical: "/companies" },
};

export default async function CompaniesPage() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.companies, TAGS.jobs);

  const companies = await getCompanies();

  return (
    <Container wide className="py-10">
      <h1 className="metal-text text-2xl font-semibold tracking-tight">Companies</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Every company here publishes a salary band on every listing and confirms its roles weekly.
      </p>

      {companies.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No companies yet.</p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <li key={c.slug} className="flex">
              <Link
                href={`/companies/${c.slug}`}
                className="metal-card flex flex-1 items-start gap-3 rounded-xl p-4"
              >
                <CompanyAvatar name={c.name} logoUrl={c.logoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{c.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {c.hq} · {c.size} people
                  </span>
                  <span className="mt-3 flex items-center gap-3 text-xs text-subtle">
                    <span className="text-fg tabular-nums">
                      {c.openRoles} open {c.openRoles === 1 ? "role" : "roles"}
                    </span>
                    {c.medianResponseDays != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" aria-hidden /> ~{c.medianResponseDays}d reply
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
