import Link from "next/link";
import { cn } from "@/lib/cn";
import { DEFAULT_SORT, JOB_SORTS, SORT_LABEL, type JobSort } from "@/lib/job-sort";

/**
 * The order of a job list, as a row of links like the filters: one tap
 * applies it, it works without JavaScript, and the result is a shareable URL.
 * `href` builds the link for each order (undefined for the default, which
 * stays out of URLs); it should drop the page cursor, so changing the order
 * starts again from the first page.
 */
export function SortControl({
  current,
  href,
  className,
}: {
  current: JobSort;
  href: (sort: JobSort | undefined) => string;
  className?: string;
}) {
  return (
    <nav aria-label="Sort jobs" className={cn("flex items-center gap-2", className)}>
      <span className="text-subtle text-[11px] font-medium tracking-[0.14em] uppercase" aria-hidden>
        Sort
      </span>
      <ul className="flex flex-wrap gap-1.5">
        {JOB_SORTS.map((sort) => (
          <li key={sort}>
            <Link
              href={href(sort === DEFAULT_SORT ? undefined : sort)}
              aria-current={sort === current ? "true" : undefined}
              scroll={false}
              className="chip h-7 px-2.5 text-xs"
            >
              {SORT_LABEL[sort]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
