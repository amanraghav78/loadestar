import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** A home page section's title, with an optional "see more" link on the right. */
export function SectionHeading({ title, href, link }: { title: string; href?: string; link?: string }) {
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
