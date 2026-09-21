/**
 * Runs the job-board sync against the database in DATABASE_URL.
 *
 *   npm run db:sync                 # all companies
 *   npm run db:sync -- stripe       # one company
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { syncAll } from "@/lib/ingest/sync";

async function main() {
  const results = await syncAll(process.argv[2]);
  for (const r of results) {
    console.log(
      r.ok
        ? `${r.name.padEnd(12)} listed ${String(r.listed).padStart(4)} (salary ${r.withSalary})  +${r.created} ~${r.updated} -${r.expired}`
        : `${r.name.padEnd(12)} FAILED ${r.error}`,
    );
  }
  const listed = results.reduce((n, r) => n + r.listed, 0);
  console.log(`\n${listed} India roles live from ${results.filter((r) => r.ok).length}/${results.length} companies`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
