import Link from "next/link";
import { cn } from "@/lib/cn";

const tagClass =
  "inline-flex items-center rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-muted";

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(tagClass, className)}>{children}</span>;
}

/** A rounded filter/shortcut chip; `active` renders it in polished silver. */
export function Chip({
  href,
  active,
  children,
  className,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} aria-current={active ? "true" : undefined} className={cn("chip", className)}>
      {children}
    </Link>
  );
}
