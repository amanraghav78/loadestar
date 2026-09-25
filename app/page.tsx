import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { ArrowRight, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { CompanyAvatar } from "@/components/company-avatar";
import { DisciplineGrid } from "@/components/discipline-grid";
import { CountUp } from "@/components/home/count-up";
import { HeroLight } from "@/components/home/hero-sky";
import { HomeEffects } from "@/components/home/home-effects";
import { LogoMarquee } from "@/components/home/logo-marquee";
import { RotatingWord } from "@/components/home/rotating-word";
import { WhyLodestar } from "@/components/home/why-lodestar";
import { JobGrid } from "@/components/job-card";
import { SearchBar } from "@/components/search-bar";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { Chip } from "@/components/ui/tag";
import { numberFormat } from "@/lib/format";
import { getHomeData, TAGS } from "@/lib/queries";
import { site } from "@/lib/site";

/** The word that keeps changing in the headline: "Your Next ___ Job Awaits." Short enough for one line on a phone. */
const ROLES = ["Backend", "Design", "Data", "Product", "Frontend", "Remote", "AI"];

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
    <div data-home className="spotlight">
      <HomeEffects />

      <section data-hero className="relative isolate overflow-hidden">
        <HeroLight />
        {/* The hero fills the first screen (less the header); the companies wait just below the fold. */}
        <Container
          wide
          className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center pt-14 pb-24 text-center sm:pt-16 sm:pb-28"
        >
          <p className="animate-fade-up metal text-muted inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium [animation-delay:150ms]">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="animate-ping-slow bg-ok absolute inline-flex size-full rounded-full opacity-75" />
              <span className="bg-ok relative inline-flex size-1.5 rounded-full" />
            </span>
            <span className="text-fg">
              <CountUp value={totalActive} />
            </span>{" "}
            live jobs across India
          </p>

          {/* The heading is the plain tagline; the animated line below is its picture. */}
          <h1 className="sr-only">{site.tagline}</h1>
          <p
            aria-hidden
            className="animate-fade-up mt-6 text-4xl leading-[1.04] font-semibold tracking-[-0.045em] [animation-delay:240ms] sm:text-6xl lg:text-7xl"
          >
            <span className="block whitespace-nowrap">
              <span className="chrome-text animate-glint">Your Next</span> <RotatingWord words={ROLES} />
            </span>
            <span className="chrome-text animate-glint block pb-2">Job Awaits.</span>
          </p>

          <p className="animate-fade-up text-muted mt-5 inline-flex items-center gap-2 text-sm [animation-delay:330ms] sm:text-base">
            <ShieldCheck className="text-silver size-4" aria-hidden />
            {site.promise}
          </p>

          <div className="animate-fade-up mt-9 w-full max-w-2xl text-left [animation-delay:420ms]">
            <SearchBar size="lg" glow />
          </div>

          <ul
            className="animate-fade-up mt-6 flex flex-wrap justify-center gap-2 [animation-delay:510ms]"
            aria-label="Shortcuts"
          >
            {SHORTCUTS.map((s) => (
              <li key={s.label}>
                <Chip href={s.href}>{s.label}</Chip>
              </li>
            ))}
          </ul>

          <a href="#hiring-now" className="scroll-cue" aria-label="Scroll to companies hiring now">
            <span />
          </a>
        </Container>

        <div className="pt-6 pb-10" data-reveal>
          <LogoMarquee companies={hiringCompanies} />
        </div>
      </section>

      <Container wide className="pt-16" data-reveal-stagger>
        <SectionHeading title="Latest jobs" href="/jobs" link={`View all ${total}`} />
        {recommended.length > 0 ? (
          <JobGrid jobs={recommended} />
        ) : (
          <EmptyState icon={BriefcaseBusiness} title="Fresh jobs are on their way">
            Check back shortly.
          </EmptyState>
        )}
      </Container>

      <Container wide className="pt-20" data-reveal-stagger>
        <SectionHeading title="Why Lodestar" />
        <WhyLodestar companies={hiringCompanies} />
      </Container>

      {cities.length > 0 && (
        <Container wide className="pt-20" data-reveal-stagger>
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

      <Container wide className="pt-20" data-reveal-stagger>
        <SectionHeading title="Browse by category" />
        <DisciplineGrid counts={disciplineCounts} />
      </Container>

      {hiringCompanies.length > 0 && (
        <Container wide className="pt-20" data-reveal-stagger>
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
    </div>
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
