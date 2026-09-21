/**
 * Dry run of the job sync: fetches every bootstrap feed, normalises it and
 * prints what would be imported. Touches no database.
 *
 *   npm run ingest:preview            # summary per company
 *   npm run ingest:preview -- --salaries   # also list every parsed salary
 */
import { BOOTSTRAP_COMPANIES } from "@/lib/ingest/companies";
import { dedupe, normalizePosting, type NormalizedJob } from "@/lib/ingest/normalize";
import { FETCHERS } from "@/lib/ingest/sources";
import { formatSalaryBand } from "@/lib/format";

const showSalaries = process.argv.includes("--salaries");

async function main() {
  const results = await Promise.all(
    BOOTSTRAP_COMPANIES.map(async (c) => {
      try {
        const raw = await FETCHERS[c.atsSource](c.atsToken);
        const jobs: NormalizedJob[] = [];
        const skips: Record<string, number> = {};
        for (const p of raw) {
          const r = normalizePosting(p);
          if ("job" in r) jobs.push(r.job);
          else skips[r.skip] = (skips[r.skip] ?? 0) + 1;
        }
        return { c, raw: raw.length, jobs: dedupe(jobs), skips };
      } catch (err) {
        return { c, error: (err as Error).message };
      }
    }),
  );

  let total = 0;
  let withPay = 0;
  for (const r of results) {
    if ("error" in r) {
      console.log(`${r.c.name.padEnd(12)} ERROR ${r.error}`);
      continue;
    }
    const paid = r.jobs.filter((j) => j.salaryMin != null);
    total += r.jobs.length;
    withPay += paid.length;
    console.log(
      `${r.c.name.padEnd(12)} feed ${String(r.raw).padStart(4)} → listed ${String(r.jobs.length).padStart(4)}  with salary ${String(paid.length).padStart(3)}   skipped ${JSON.stringify(r.skips)}`,
    );
    if (showSalaries) {
      for (const j of paid) console.log(`    ${(formatSalaryBand(j.salaryMin, j.salaryMax, "INR") ?? "").padEnd(16)} ${j.title} · ${j.location}`);
    }
  }
  console.log(`\nTOTAL listed ${total}, with salary ${withPay}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
