import Link from "next/link";
import { CompanyAvatar } from "@/components/company-avatar";

type MarqueeCompany = { name: string; slug: string; logoUrl: string | null };

/**
 * The companies hiring right now, drifting past in an endless row. The list is
 * drawn twice and the track slides by exactly one copy, so the loop has no seam;
 * the copy is hidden from assistive tech and the keyboard. Hovering pauses it.
 */
export function LogoMarquee({ companies }: { companies: MarqueeCompany[] }) {
  if (companies.length < 5) return null;

  const row = (copy: boolean) => (
    <ul className="marquee-group" aria-hidden={copy || undefined}>
      {companies.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/companies/${c.slug}`}
            tabIndex={copy ? -1 : undefined}
            className="text-muted hover:text-fg flex items-center gap-3 text-sm font-medium whitespace-nowrap transition-colors"
          >
            <CompanyAvatar company={c} />
            {c.name}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-labelledby="hiring-now" className="relative pb-6">
      <h2 id="hiring-now" className="text-subtle text-center text-[11px] font-medium tracking-[0.2em] uppercase">
        Hiring now on Lodestar
      </h2>
      <div className="marquee mt-6">
        <div className="marquee-track">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  );
}
