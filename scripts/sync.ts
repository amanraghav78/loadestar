/**
 * Runs the job sync against the database in DATABASE_URL, repeating until
 * every company has been synced once.
 *
 *   npm run db:sync                 # all companies
 *   npm run db:sync -- stripe       # one company
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { syncAll } from "@/lib/ingest/sync";

async function main() {
  const only = process.argv[2];
  const seen = new Set<string>();
  let listed = 0;
  let pending = 0;
  for (;;) {
    const { results, remaining, purged } = await syncAll({ onlySlug: only, budgetMs: 240_000 });
    for (const r of results) {
      if (seen.has(r.slug)) continue;
      seen.add(r.slug);
      listed += r.listed;
      pending += r.pending;
      console.log(
        r.ok
          ? `${r.name.slice(0, 28).padEnd(28)} listed ${String(r.listed).padStart(4)} (salary ${r.withSalary})  +${r.created} ~${r.updated} -${r.expired}${r.pending ? `  ${r.pending} pending` : ""}`
          : `${r.name.slice(0, 28).padEnd(28)} FAILED ${r.error}`,
      );
    }
    if (purged) console.log(`deleted ${purged} roles posted 30+ days ago`);
    const feeds = await db.company.count({ where: { atsSource: { not: null }, atsToken: { not: null } } });
    if (remaining === 0 || only || seen.size >= feeds) break;
  }
  const live = await db.job.count({ where: { status: "ACTIVE" } });
  console.log(`\n${listed} India roles listed by ${seen.size} companies this run (${pending} descriptions pending); ${live} live in total`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
