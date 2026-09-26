/**
 * Fills Job.experienceMin / experienceMax for synced listings stored before
 * the columns existed, by reading the stored title and description with the
 * same parser the sync uses (parseExperience in lib/ingest/normalize.ts).
 *
 * Why a script: the sync only rewrites a row when its content hash changes,
 * and experience is left out of the hash (it is derived from the title and
 * description, which are hashed already), so rows that haven't changed would
 * otherwise stay empty. Search-style sources never re-read a stored role's
 * description at all.
 *
 * Safe to run any number of times: it only writes rows whose stored value
 * differs from what the parser reads now, so a second run writes nothing, and
 * running it again after a parser change updates just the rows that change.
 * Listings entered by hand (source MANUAL) are never touched: their years are
 * what the recruiter or admin typed.
 *
 *   npm run db:backfill-experience              # dry run: counts and samples, writes nothing
 *   npm run db:backfill-experience -- --write   # apply
 *
 * Runs against DATABASE_URL. Pages are cached for minutes to hours, so the
 * site picks the values up as those caches expire (or on the next sync).
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { parseExperience } from "@/lib/ingest/normalize";

const BATCH = 500;
const WRITE_CONCURRENCY = 10;

async function main() {
  const write = process.argv.includes("--write");
  let cursor: string | undefined;
  let scanned = 0;
  let changed = 0;
  const samples: string[] = [];

  for (;;) {
    const jobs = await db.job.findMany({
      where: { status: "ACTIVE", source: { not: "MANUAL" } },
      select: { id: true, title: true, description: true, experienceMin: true, experienceMax: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (jobs.length === 0) break;
    cursor = jobs[jobs.length - 1]!.id;
    scanned += jobs.length;

    const updates = jobs.flatMap((job) => {
      const years = parseExperience(job.title, job.description);
      const data = { experienceMin: years?.min ?? null, experienceMax: years?.max ?? null };
      if (data.experienceMin === job.experienceMin && data.experienceMax === job.experienceMax) return [];
      if (samples.length < 15) {
        samples.push(
          `  ${job.title.slice(0, 60).padEnd(60)} → ${data.experienceMin ?? "?"}-${data.experienceMax ?? "+"}`,
        );
      }
      return [{ id: job.id, data }];
    });
    changed += updates.length;

    if (write) {
      for (let i = 0; i < updates.length; i += WRITE_CONCURRENCY) {
        await Promise.all(
          updates
            .slice(i, i + WRITE_CONCURRENCY)
            .map((u) => db.job.update({ where: { id: u.id }, data: u.data, select: { id: true } })),
        );
      }
    }
    console.log(`${scanned} scanned, ${changed} ${write ? "updated" : "to update"}`);
  }

  if (samples.length) console.log(`\nFor example:\n${samples.join("\n")}`);
  console.log(
    write
      ? `\nDone: ${changed} of ${scanned} active synced listings updated.`
      : `\nDry run: ${changed} of ${scanned} active synced listings would change. Pass --write to apply.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
