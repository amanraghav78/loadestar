import Link from "next/link";
import { cn } from "@/lib/cn";

type Company = { slug: string; name: string };

// Each row must be wider than the viewport for the loop to look seamless.
const MIN_ITEMS_PER_ROW = 12;

/**
 * Infinite, CSS-only scrolling strip of hiring companies. The list is repeated
 * to fill the row and then rendered twice; every repeat is hidden from
 * assistive tech and the tab order. With reduced motion only the original
 * names are shown and the strip wraps instead of scrolling.
 */
export function CompanyMarquee({ companies }: { companies: Company[] }) {
  const repeats = Math.max(1, Math.ceil(MIN_ITEMS_PER_ROW / companies.length));
  const row = Array.from({ length: repeats }, () => companies).flat();

  return (
    <div className="group fade-x flex overflow-hidden [--marquee-gap:3rem] motion-reduce:[mask-image:none]">
      <MarqueeRow items={row} originals={companies.length} />
      <MarqueeRow items={row} originals={0} />
    </div>
  );
}

function MarqueeRow({ items, originals }: { items: Company[]; originals: number }) {
  const isCopy = originals === 0;
  return (
    <ul
      aria-hidden={isCopy || undefined}
      className={cn(
        "animate-marquee flex shrink-0 items-center gap-(--marquee-gap) pr-(--marquee-gap) group-hover:[animation-play-state:paused]",
        "motion-reduce:shrink motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:gap-y-3",
        isCopy && "motion-reduce:hidden",
      )}
    >
      {items.map((c, i) => {
        const hidden = i >= originals;
        return (
          <li key={i} aria-hidden={(!isCopy && hidden) || undefined} className={cn(hidden && "motion-reduce:hidden")}>
            <Link
              href={`/companies/${c.slug}`}
              tabIndex={hidden ? -1 : undefined}
              className="text-subtle hover:text-fg text-lg font-semibold tracking-tight whitespace-nowrap transition-colors"
            >
              {c.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
