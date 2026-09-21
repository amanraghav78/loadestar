import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Use Neon's direct (non-pooled) URL for migrations when available.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
