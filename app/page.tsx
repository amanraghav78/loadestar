import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { ArrowRight, CircleDollarSign, Clock, Route } from "lucide-react";
import { CompanyMarquee } from "@/components/company-marquee";
import { DisciplineGrid } from "@/components/discipline-grid";
import { JobGrid } from "@/components/job-card";
import { SearchBar } from "@/components/search-bar";
import { Container } from "@/components/ui/container";
import { TagLink } from "@/components/ui/tag";
import { numberFormat } from "@/lib/format";
import { getHomeData, TAGS } from "@/lib/queries";
import { site } from "@/lib/site";

const POPULAR = [
  { label: "With salary", href: "/jobs?salary=1" },
  { label: "Bengaluru", href: "/jobs?city=Bengaluru" },
  { label: "Remote", href: "/jobs?remote=REMOTE" },
  { label: "Backend", href: "/jobs?q=backend" },
  { label: "Data science", href: "/jobs?discipline=DATA" },
];

const PROMISES = [
  {
    icon: CircleDollarSign,
    title: "Pay first",
    body: "Roles that publish a salary are marked and shown first, in ₹ LPA. One click filters to only those. Where a company doesn't disclose pay, we say so.",
  },
  {
    icon: Clock,
    title: "No ghost listings",
    body: "Every role comes from the company's own careers page and is re-checked daily. When it disappears there, it comes down here.",
  },
  {
    icon: Route,
    title: "Apply at the source",
    body: "Apply on the company's own careers page. No middlemen, no recruiter inbox, no sign-up needed.",
  },
];

/**
 * The whole landing page is cached (UI-level `use cache`) and served as a
 * static shell; admin writes and the expiry cron revalidate it via tags.
 */
export default async function HomePage() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.jobs, TAGS.companies);

  const { recommended, totalActive, withSalary, disciplineCounts, hiringCompanies } = await getHomeData();
  const total = numberFormat.format(totalActive);

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="hero-backdrop" aria-hidden />
        <Container className="flex flex-col items-center pt-20 pb-16 text-center sm:pt-28">
          <p className="animate-fade-up border-line-strong bg-card/60 text-muted inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="animate-ping-slow bg-ok absolute inline-flex size-full rounded-full opacity-75" />
              <span className="bg-ok relative inline-flex size-1.5 rounded-full" />
            </span>
            {total} open tech roles in India
            {withSalary > 0 && <> · {numberFormat.format(withSalary)} with salary</>}
          </p>
          <h1 className="animate-fade-up gradient-text mt-6 max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight [animation-delay:80ms] sm:text-6xl">
            Find the room where the work is real.
          </h1>
          <p className="animate-fade-up text-muted mt-5 max-w-xl text-base leading-relaxed [animation-delay:160ms]">
            {site.description}
          </p>

          <div className="animate-fade-up mt-10 w-full max-w-2xl text-left [animation-delay:240ms]">
            <SearchBar />
          </div>

          <div className="animate-fade-up mt-5 flex flex-wrap items-center justify-center gap-2 [animation-delay:320ms]">
            <span className="text-subtle text-xs">Popular:</span>
            {POPULAR.map((p) => (
              <TagLink key={p.label} href={p.href}>
                {p.label}
              </TagLink>
            ))}
          </div>
        </Container>
      </section>

      <Container className="reveal pb-16">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-fg text-lg font-semibold">Recommended for you</h2>
          <Link href="/jobs" className="group text-accent-fg hover:text-fg inline-flex items-center gap-1 text-xs">
            View all {total}
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
        {recommended.length > 0 ? (
          <JobGrid jobs={recommended} />
        ) : (
          <p className="border-line text-muted rounded-xl border border-dashed p-8 text-center text-sm">
            Roles are syncing from company careers pages. Check back shortly.
          </p>
        )}
      </Container>

      <Container className="reveal pb-20">
        <h2 className="text-fg mb-4 text-lg font-semibold">Browse by discipline</h2>
        <DisciplineGrid counts={disciplineCounts} />
      </Container>

      {hiringCompanies.length > 0 && (
        <section aria-labelledby="hiring" className="reveal border-line bg-surface border-y py-10">
          <h2 id="hiring" className="text-subtle mb-6 text-center text-[11px] font-medium tracking-[0.12em] uppercase">
            Hiring on Lodestar
          </h2>
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <CompanyMarquee companies={hiringCompanies} />
          </div>
        </section>
      )}

      <Container className="reveal py-20">
        <ul className="grid gap-3 sm:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="metal-card group rounded-xl p-5">
              <span className="border-accent/30 bg-accent/10 flex size-9 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                <Icon className="text-accent-fg size-4" aria-hidden />
              </span>
              <h3 className="text-fg mt-4 text-sm font-semibold">{title}</h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
