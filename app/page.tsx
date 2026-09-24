import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { CompanyAvatar } from "@/components/company-avatar";
import { DisciplineGrid } from "@/components/discipline-grid";
import { JobGrid } from "@/components/job-card";
import { SearchBar } from "@/components/search-bar";
import { Container } from "@/components/ui/container";
import { Chip } from "@/components/ui/tag";
import { numberFormat } from "@/lib/format";
import { getHomeData, TAGS } from "@/lib/queries";
import { site } from "@/lib/site";

const SHORTCUTS = [
  { label: "With salary", href: "/jobs?salary=1" },
  { label: "Remote", href: "/jobs?remote=REMOTE" },
  { label: "Backend", href: "/jobs?q=backend" },
  { label: "Frontend", href: "/jobs?q=frontend" },
  { label: "Data science", href: "/jobs?discipline=DATA" },
  { label: "Internships", href: "/jobs?level=INTERN" },
];

/**
 * The whole landing page is cached (UI-level `use cache`) and served as a
 * static shell; the sync and admin writes revalidate it via tags.
 */
export default async function HomePage() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.jobs, TAGS.companies);

  const { recommended, totalActive, disciplineCounts, hiringCompanies, cities, remoteCount } = await getHomeData();
  const total = numberFormat.format(totalActive);

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="hero-grid" aria-hidden />
        <Container wide className="flex flex-col items-center pt-16 pb-16 text-center sm:pt-28 sm:pb-20">
          <p className="animate-fade-up metal text-muted inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="animate-ping-slow bg-ok absolute inline-flex size-full rounded-full opacity-75" />
              <span className="bg-ok relative inline-flex size-1.5 rounded-full" />
            </span>
            <span className="text-fg tabular-nums">{total}</span> live jobs across India
          </p>

          <div className="animate-fade-up [animation-delay:90ms]">
            <h1 className="chrome-text animate-glint mt-6 pb-1.5 text-4xl leading-[1.05] font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              {site.tagline}
            </h1>
          </div>

          <p className="animate-fade-up text-muted mt-5 inline-flex items-center gap-2 text-sm [animation-delay:180ms] sm:text-base">
            <ShieldCheck className="text-silver size-4" aria-hidden />
            {site.promise}
          </p>

          <div className="animate-fade-up mt-9 w-full max-w-2xl text-left [animation-delay:270ms]">
            <SearchBar size="lg" />
          </div>

          <ul
            className="animate-fade-up mt-6 flex flex-wrap justify-center gap-2 [animation-delay:360ms]"
            aria-label="Shortcuts"
          >
            {SHORTCUTS.map((s) => (
              <li key={s.label}>
                <Chip href={s.href}>{s.label}</Chip>
              </li>
            ))}
          </ul>
        </Container>
        <div className="hairline mx-auto max-w-5xl" aria-hidden />
      </section>

      <Container wide className="reveal pt-16">
        <SectionHeading title="Latest jobs" href="/jobs" link={`View all ${total}`} />
        {recommended.length > 0 ? (
          <JobGrid jobs={recommended} />
        ) : (
          <p className="border-line text-muted rounded-2xl border border-dashed p-10 text-center text-sm">
            Fresh jobs are on their way. Check back shortly.
          </p>
        )}
      </Container>

      {cities.length > 0 && (
        <Container wide className="reveal pt-20">
          <SectionHeading title="Jobs by city" />
          <ul className="flex flex-wrap gap-2">
            {cities.map(({ city, count }) => (
              <li key={city}>
                <Chip href={`/jobs?city=${city}`} className="h-10 px-4 text-sm">
                  {city}
                  <span className="text-subtle text-xs tabular-nums">{numberFormat.format(count)}</span>
                </Chip>
              </li>
            ))}
            {remoteCount > 0 && (
              <li>
                <Chip href="/jobs?remote=REMOTE" className="h-10 px-4 text-sm">
                  Remote
                  <span className="text-subtle text-xs tabular-nums">{numberFormat.format(remoteCount)}</span>
                </Chip>
              </li>
            )}
          </ul>
        </Container>
      )}

      <Container wide className="reveal pt-20">
        <SectionHeading title="Browse by category" />
        <DisciplineGrid counts={disciplineCounts} />
      </Container>

      {hiringCompanies.length > 0 && (
        <Container wide className="reveal pt-20">
          <SectionHeading title="Top companies hiring" href="/companies" link="All companies" />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {hiringCompanies.map((c) => (
              <li key={c.slug} className="flex min-w-0">
                <Link
                  href={`/companies/${c.slug}`}
                  className="metal-card flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3.5"
                >
                  <CompanyAvatar company={c} />
                  <span className="min-w-0">
                    <span className="text-fg block truncate text-sm font-semibold">{c.name}</span>
                    <span className="text-subtle block text-xs tabular-nums">
                      {numberFormat.format(c.openRoles)} {c.openRoles === 1 ? "job" : "jobs"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      )}
    </>
  );
}

function SectionHeading({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="steel-text text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {href && link && (
        <Link
          href={href}
          className="group text-muted hover:text-fg inline-flex items-center gap-1 text-sm transition-colors"
        >
          {link}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
