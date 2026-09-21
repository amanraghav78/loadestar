import Link from "next/link";
import { ArrowUpRight, BarChart3, Code2, Compass, Layers, Lock, PenTool, type LucideIcon } from "lucide-react";
import { DISCIPLINE_LABEL, numberFormat } from "@/lib/format";
import type { Discipline } from "@/lib/generated/prisma/enums";

const ICONS: Record<Discipline, LucideIcon> = {
  ENGINEERING: Code2,
  DESIGN: PenTool,
  PRODUCT: Compass,
  DATA: BarChart3,
  SECURITY: Lock,
  INFRASTRUCTURE: Layers,
};

const ORDER: Discipline[] = ["ENGINEERING", "DESIGN", "PRODUCT", "DATA", "SECURITY", "INFRASTRUCTURE"];

export function DisciplineGrid({ counts }: { counts: Partial<Record<Discipline, number>> }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {ORDER.map((d) => {
        const Icon = ICONS[d];
        const count = counts[d] ?? 0;
        return (
          <li key={d}>
            <Link
              href={`/jobs?discipline=${d}`}
              className="metal-card group flex items-center gap-3 rounded-xl px-4 py-3.5"
            >
              <Icon className="size-4 shrink-0 text-accent-fg" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{DISCIPLINE_LABEL[d]}</span>
                <span className="block text-xs text-subtle tabular-nums">
                  {numberFormat.format(count)} {count === 1 ? "role" : "roles"}
                </span>
              </span>
              <ArrowUpRight
                className="size-3.5 shrink-0 text-subtle transition-colors group-hover:text-fg"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
