import Link from "next/link";
import { cn } from "@/lib/cn";

const tagClass =
  "inline-flex items-center rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-muted";

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(tagClass, className)}>{children}</span>;
}

export function TagLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(tagClass, "px-2.5 py-1 hover:border-line-strong hover:text-fg")}>
      {children}
    </Link>
  );
}
