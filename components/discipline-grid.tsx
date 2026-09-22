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

const ORDER: Discipline[] = ["ENGINEERING", "DATA", "INFRASTRUCTURE", "PRODUCT", "SECURITY", "DESIGN"];

export function DisciplineGrid({ counts }: { counts: Partial<Record<Discipline, number>> }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {ORDER.map((d) => {
        const Icon = ICONS[d];
        const count = counts[d] ?? 0;
        return (
          <li key={d} className="flex">
            <Link href={`/jobs?discipline=${d}`} className="metal-card group flex flex-1 items-center gap-4 rounded-2xl p-4 sm:p-5">
              <span className="metal flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Icon className="size-5 text-silver transition-transform duration-300 group-hover:scale-110" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-fg sm:text-[15px]">{DISCIPLINE_LABEL[d]}</span>
                <span className="block text-xs text-subtle tabular-nums">
                  {numberFormat.format(count)} {count === 1 ? "job" : "jobs"}
                </span>
              </span>
              <ArrowUpRight
                className="hidden size-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg sm:block"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
