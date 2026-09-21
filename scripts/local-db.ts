/**
 * Zero-install local Postgres for development and CI smoke tests.
 * Runs PGlite (Postgres compiled to WASM) behind a real TCP socket so Prisma
 * and `pg` connect to it exactly like they would to Neon.
 *
 *   npm run db:local            # persistent, data in .pglite/
 *   npm run db:local -- --memory
 *
 * Then set DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable
 */
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.LOCAL_DB_PORT ?? 5433);
const inMemory = process.argv.includes("--memory");

async function main() {
  const db = await PGlite.create(inMemory ? "memory://" : "./.pglite", {
    extensions: { pg_trgm },
  });
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 64 });
  await server.start();
  console.log(
    `Local Postgres ready: postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`,
  );

  const shutdown = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
