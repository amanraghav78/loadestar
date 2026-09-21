import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { ArrowRight, CircleDollarSign, Clock, Route } from "lucide-react";
import { DisciplineGrid } from "@/components/discipline-grid";
import { JobGrid } from "@/components/job-card";
import { SearchBar } from "@/components/search-bar";
import { Container } from "@/components/ui/container";
import { TagLink } from "@/components/ui/tag";
import { numberFormat } from "@/lib/format";
import { getHomeData, TAGS } from "@/lib/queries";
import { site } from "@/lib/site";

const POPULAR = [
  { label: "Remote", href: "/jobs?remote=REMOTE" },
  { label: "Go", href: "/jobs?tag=Go" },
  { label: "Design systems", href: "/jobs?q=design+systems" },
  { label: "Staff engineer", href: "/jobs?q=staff+engineer" },
  { label: "Fintech", href: "/jobs?tag=Fintech" },
];

const PROMISES = [
  {
    icon: CircleDollarSign,
    title: "Every band published",
    body: "A listing without a salary range does not go live. You know what the role pays before you spend an evening on the application.",
  },
  {
    icon: Clock,
    title: "Expired roles come down",
    body: `Employers confirm each posting weekly. Anything unconfirmed after ${site.expiryDays} days is removed automatically.`,
  },
  {
    icon: Route,
    title: "Applications go straight to the source",
    body: "Apply on the company's own careers page or form. No middlemen, no recruiter inbox, and the company's median response time shown up front.",
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

  const { recommended, totalActive, disciplineCounts, hiringCompanies } = await getHomeData();
  const total = numberFormat.format(totalActive);

  return (
    <>
      <Container className="pt-16 pb-12 sm:pt-20">
        <p className="text-[11px] font-medium tracking-[0.14em] text-accent-fg uppercase">
          {total} open roles in product &amp; engineering
        </p>
        <h1 className="mt-4 max-w-xl text-4xl leading-[1.08] font-semibold tracking-tight metal-text sm:text-5xl">
          Find the room where the work is real.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{site.description}</p>

        <div className="mt-8">
          <SearchBar />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-subtle">Popular:</span>
          {POPULAR.map((p) => (
            <TagLink key={p.label} href={p.href}>
              {p.label}
            </TagLink>
          ))}
        </div>
      </Container>

      <Container className="pb-14">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-fg">Recommended for you</h2>
          <Link href="/jobs" className="inline-flex items-center gap-1 text-xs text-accent-fg hover:text-fg">
            View all {total}
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
        {recommended.length > 0 ? (
          <JobGrid jobs={recommended} />
        ) : (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            New roles are being verified. Check back shortly.
          </p>
        )}
      </Container>

      <Container className="pb-16">
        <h2 className="mb-4 text-lg font-semibold text-fg">Browse by discipline</h2>
        <DisciplineGrid counts={disciplineCounts} />
      </Container>

      {hiringCompanies.length > 0 && (
        <section aria-labelledby="hiring" className="border-y border-line bg-surface">
          <Container className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:gap-8">
            <h2 id="hiring" className="shrink-0 text-[11px] font-medium tracking-[0.12em] text-subtle uppercase">
              Hiring on Lodestar
            </h2>
            <ul className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-3 sm:justify-between">
              {hiringCompanies.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/companies/${c.slug}`}
                    className="text-base font-semibold tracking-tight text-muted transition-colors hover:text-fg"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <Container className="py-16">
        <ul className="grid gap-10 sm:grid-cols-3 sm:gap-8">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Icon className="size-5 text-accent-fg" aria-hidden />
              <h3 className="mt-3 text-sm font-semibold text-fg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
