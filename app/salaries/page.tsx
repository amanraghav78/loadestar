import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { Container } from "@/components/ui/container";
import { DISCIPLINE_LABEL, formatMoney, LEVEL_LABEL, numberFormat } from "@/lib/format";
import type { Discipline } from "@/lib/generated/prisma/enums";
import { getSalaryStats, TAGS, type SalaryRow } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Salary data",
  description:
    "INR salary ranges for tech roles in India, calculated from pay that companies publish on live listings.",
  alternates: { canonical: "/salaries" },
};

export default async function SalariesPage() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.jobs);

  const rows = await getSalaryStats();
  const byDiscipline = new Map<Discipline, SalaryRow[]>();
  for (const row of rows) {
    const list = byDiscipline.get(row.discipline) ?? [];
    list.push(row);
    byDiscipline.set(row.discipline, list);
  }

  return (
    <Container wide className="py-10">
      <h1 className="metal-text text-2xl font-semibold tracking-tight">Salary data</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Calculated from the midpoint of every INR salary published on a live listing, refreshed hourly. Most
        Indian employers don&rsquo;t publish pay yet, so this only covers roles that do; groups with a single
        role are hidden.
      </p>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          Not enough live listings publish pay yet to show salary data. It fills in as more companies disclose
          salaries.
        </p>
      ) : (
        <div className="mt-10 space-y-12">
          {[...byDiscipline].map(([discipline, list]) => (
            <section key={discipline} aria-labelledby={`s-${discipline}`}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id={`s-${discipline}`} className="text-lg font-semibold">
                  {DISCIPLINE_LABEL[discipline]}
                </h2>
                <Link href={`/jobs?discipline=${discipline}`} className="text-xs text-muted hover:text-fg">
                  See roles →
                </Link>
              </div>
              <div className="metal-panel overflow-x-auto rounded-xl">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead className="bg-surface text-left text-[11px] tracking-wide text-subtle uppercase">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        Level
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        Currency
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        25th pct
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        Median
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        75th pct
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        Roles
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular-nums">
                    {list.map((r) => (
                      <tr key={`${r.level}-${r.currency}`} className="bg-card">
                        <th scope="row" className="px-4 py-2.5 text-left font-medium text-fg">
                          {LEVEL_LABEL[r.level]}
                        </th>
                        <td className="px-4 py-2.5 text-muted">{r.currency}</td>
                        <td className="px-4 py-2.5 text-right text-muted">{formatMoney(r.p25, r.currency)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-fg">
                          {formatMoney(r.median, r.currency)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted">{formatMoney(r.p75, r.currency)}</td>
                        <td className="px-4 py-2.5 text-right text-muted">{numberFormat.format(r.roles)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}
