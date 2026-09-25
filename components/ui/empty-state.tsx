import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * What a list shows when it has nothing in it: an icon, one line saying so,
 * a hint, and the next step. Every empty list uses this, so they all read the
 * same way.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-line rounded-3xl border border-dashed px-6 py-12 text-center", className)}>
      <span className="metal mx-auto flex size-11 items-center justify-center rounded-2xl" aria-hidden>
        <Icon className="text-muted size-5" />
      </span>
      <p className="text-fg mt-4 text-base font-medium">{title}</p>
      {children && <p className="text-muted mx-auto mt-1 max-w-md text-sm leading-relaxed">{children}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
