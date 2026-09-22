import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { DISCIPLINE_LABEL, formatMoney, LEVEL_LABEL, numberFormat } from "@/lib/format";
import type { Discipline } from "@/lib/generated/prisma/enums";
import { getSalaryStats, TAGS, type SalaryRow } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Salary data",
  description: "Salary ranges for tech jobs in India, by role and level.",
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
    <Container wide className="py-12">
      <h1 className="steel-text text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Salaries</h1>
      <p className="mt-2 text-sm text-muted">Published pay for live jobs, by level.</p>

      {rows.length === 0 ? (
        <div className="metal mt-10 rounded-3xl p-10 text-center">
          <p className="text-base font-medium text-fg">Not enough salary data yet</p>
          <p className="mt-1 text-sm text-muted">Browse jobs that show pay while this fills in.</p>
          <Link href="/jobs?salary=1" className={buttonClass("secondary", "md", "mt-5")}>
            Jobs with salary
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          {[...byDiscipline].map(([discipline, list]) => (
            <section key={discipline} aria-labelledby={`s-${discipline}`}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id={`s-${discipline}`} className="text-lg font-semibold">
                  {DISCIPLINE_LABEL[discipline]}
                </h2>
                <Link href={`/jobs?discipline=${discipline}`} className="text-xs text-muted hover:text-fg">
                  See jobs →
                </Link>
              </div>
              <div className="metal overflow-x-auto rounded-2xl">
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
