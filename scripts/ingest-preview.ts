/**
 * Dry run of the job sync: fetches bootstrap feeds, normalises them and prints
 * what would be imported. Touches no database.
 *
 *   npm run ingest:preview                       # every company
 *   npm run ingest:preview -- nvidia amazon      # just these slugs
 *   npm run ingest:preview -- --salaries         # also list every parsed salary
 *   npm run ingest:preview -- --detail           # also fetch 2 descriptions per search-style company
 */
import { BOOTSTRAP_COMPANIES } from "@/lib/ingest/companies";
import { dedupe, normalizePosting, type NormalizedJob } from "@/lib/ingest/normalize";
import { FETCHERS, splitTokens, type RawPosting } from "@/lib/ingest/sources";
import { formatSalaryBand } from "@/lib/format";
import { listingCutoff } from "@/lib/listing-age";

const args = process.argv.slice(2);
const showSalaries = args.includes("--salaries");
const checkDetail = args.includes("--detail");
const slugs = args.filter((a) => !a.startsWith("--"));
const companies = slugs.length ? BOOTSTRAP_COMPANIES.filter((c) => slugs.includes(c.slug)) : BOOTSTRAP_COMPANIES;

async function preview(c: (typeof BOOTSTRAP_COMPANIES)[number]) {
  const since = listingCutoff();
  const started = Date.now();
  const raw: RawPosting[] = [];
  for (const token of splitTokens(c.atsToken)) raw.push(...(await FETCHERS[c.atsSource](token, { since })));
  const jobs: NormalizedJob[] = [];
  const skips: Record<string, number> = {};
  for (const p of raw) {
    const r = normalizePosting(p, since);
    if ("job" in r) jobs.push(r.job);
    else skips[r.skip] = (skips[r.skip] ?? 0) + 1;
  }
  const listed = dedupe(jobs);
  let detailNote = "";
  if (checkDetail) {
    const sample = listed.map((j) => raw.find((p) => p.externalId === j.externalId)!).filter((p) => p.detail).slice(0, 2);
    const lengths = await Promise.all(sample.map(async (p) => (await p.detail!()).description.length));
    if (lengths.length) detailNote = `  detail chars ${lengths.join(",")}`;
  }
  return { c, raw: raw.length, jobs: listed, skips, ms: Date.now() - started, detailNote };
}

async function main() {
  const queue = [...companies];
  const results: Awaited<ReturnType<typeof preview>>[] = [];
  const errors: string[] = [];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        try {
          results.push(await preview(c));
        } catch (err) {
          errors.push(`${c.name.padEnd(28)} ERROR ${(err as Error).message}`);
        }
      }
    }),
  );

  let total = 0;
  let withPay = 0;
  for (const r of results.sort((a, b) => b.jobs.length - a.jobs.length)) {
    const paid = r.jobs.filter((j) => j.salaryMin != null);
    total += r.jobs.length;
    withPay += paid.length;
    console.log(
      `${r.c.name.slice(0, 28).padEnd(28)} ${r.c.atsSource.padEnd(15)} recent ${String(r.raw).padStart(4)} → listed ${String(r.jobs.length).padStart(4)}  salary ${String(paid.length).padStart(3)}  ${String(Math.round(r.ms / 1000)).padStart(3)}s  skipped ${JSON.stringify(r.skips)}${r.detailNote}`,
    );
    if (showSalaries) {
      for (const j of paid) console.log(`    ${(formatSalaryBand(j.salaryMin, j.salaryMax, "INR") ?? "").padEnd(16)} ${j.title} · ${j.location}`);
    }
  }
  for (const e of errors) console.log(e);
  console.log(`\nTOTAL listed ${total} from ${results.length} companies (${errors.length} failed), with salary ${withPay}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
