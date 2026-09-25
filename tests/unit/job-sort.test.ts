import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Currency } from "@/lib/generated/prisma/enums";
import {
  afterCursor,
  compareJobs,
  CURRENCY_DB_ORDER,
  JOB_SORTS,
  orderByFor,
  type JobSort,
  type SortRow,
} from "@/lib/job-sort";
import { parseSearchParams, parseSort, toQueryString } from "@/lib/validators";

const day = (n: number) => new Date(Date.UTC(2026, 8, n));

function row(id: string, postedDay: number, band?: [Currency, number, number]): SortRow {
  return {
    id,
    postedAt: day(postedDay),
    salaryDisclosed: Boolean(band),
    currency: band?.[0] ?? null,
    salaryMin: band?.[1] ?? null,
    salaryMax: band?.[2] ?? null,
  };
}

// Ties on every column but id, bands in several currencies, and no-salary rows.
const rows: SortRow[] = [
  row("j01", 1),
  row("j02", 5, ["INR", 1_200_000, 1_600_000]),
  row("j03", 5, ["INR", 2_400_000, 3_000_000]),
  row("j04", 3, ["USD", 110_000, 140_000]),
  row("j05", 9),
  row("j06", 9),
  row("j07", 2, ["INR", 2_000_000, 3_000_000]),
  row("j08", 2, ["INR", 2_400_000, 3_000_000]),
  row("j09", 7, ["EUR", 95_000, 125_000]),
  row("j10", 7),
  row("j11", 4, ["INR", 600_000, 900_000]),
  row("j12", 8, ["GBP", 72_000, 88_000]),
];

const ids = (list: SortRow[]) => list.map((r) => r.id);

/** Evaluates the subset of a Prisma `where` that afterCursor builds, against one row. */
function matches(where: Prisma.JobWhereInput, r: SortRow): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Prisma.JobWhereInput[]).some((w) => matches(w, r));
    if (key === "AND") return (cond as Prisma.JobWhereInput[]).every((w) => matches(w, r));
    const value = r[key as keyof SortRow];
    const plain = (v: unknown) => (v instanceof Date ? v.getTime() : v);
    if (cond === null || typeof cond !== "object" || cond instanceof Date) return plain(value) === plain(cond);
    const c = cond as { lt?: unknown; gt?: unknown; in?: unknown[] };
    if (value === null) return false;
    if (c.in) return c.in.includes(value);
    if (c.lt !== undefined) return (plain(value) as number) < (plain(c.lt) as number);
    if (c.gt !== undefined) return (plain(value) as number) > (plain(c.gt) as number);
    throw new Error(`unexpected condition on ${key}`);
  });
}

/** Pages through `rows` the way searchJobs does, with the cursor on the last row of each page. */
function paginate(sort: JobSort, pageSize: number) {
  const ordered = [...rows].sort(compareJobs(sort));
  const seen: string[] = [];
  let cursor: SortRow | null = null;
  for (let guard = 0; guard < rows.length + 1; guard++) {
    const remaining: SortRow[] = cursor ? ordered.filter((r) => matches(afterCursor(sort, cursor!), r)) : ordered;
    const page = remaining.slice(0, pageSize);
    if (page.length === 0) break;
    seen.push(...ids(page));
    cursor = page[page.length - 1]!;
  }
  return { ordered: ids(ordered), seen };
}

describe("job ordering", () => {
  it("recommended puts published pay first, then newest", () => {
    expect(ids([...rows].sort(compareJobs("recommended")))).toEqual([
      "j12",
      "j09",
      "j03",
      "j02",
      "j11",
      "j04",
      "j08",
      "j07", // with a band, newest first
      "j06",
      "j05",
      "j10",
      "j01", // without, newest first
    ]);
  });

  it("newest ignores pay and breaks ties on id", () => {
    expect(ids([...rows].sort(compareJobs("newest")))).toEqual([
      "j06",
      "j05",
      "j12",
      "j10",
      "j09",
      "j03",
      "j02",
      "j11",
      "j04",
      "j08",
      "j07",
      "j01",
    ]);
  });

  it("highest salary ranks INR bands by their top, other currencies after, no salary last", () => {
    expect(ids([...rows].sort(compareJobs("salary")))).toEqual([
      "j03",
      "j08", // same ₹30L band: the newer one first
      "j07", // same top, lower floor
      "j02",
      "j11",
      "j04",
      "j12",
      "j09", // USD, GBP, EUR
      "j06",
      "j05",
      "j10",
      "j01",
    ]);
  });

  it("knows the order Postgres keeps the Currency enum in", () => {
    // Replays CREATE TYPE / ADD VALUE from the migrations, in the order they run.
    const dir = path.join(process.cwd(), "prisma/migrations");
    const order: string[] = [];
    for (const migration of readdirSync(dir).sort()) {
      const file = path.join(dir, migration, "migration.sql");
      if (!existsSync(file)) continue;
      const sql = readFileSync(file, "utf8");
      const created = sql.match(/CREATE TYPE "Currency" AS ENUM \(([^)]*)\)/);
      if (created) order.push(...[...created[1]!.matchAll(/'(\w+)'/g)].map((m) => m[1]!));
      for (const added of sql.matchAll(/ALTER TYPE "Currency" ADD VALUE (?:IF NOT EXISTS )?'(\w+)'/g)) {
        order.push(added[1]!);
      }
    }
    expect(order).toEqual([...CURRENCY_DB_ORDER]);
  });

  it("every order ends on id, so it is total", () => {
    for (const sort of JOB_SORTS) {
      expect(orderByFor(sort).at(-1)).toEqual({ id: "desc" });
    }
  });

  it("salary puts rows without a band last in the database too", () => {
    expect(orderByFor("salary")).toContainEqual({ salaryMax: { sort: "desc", nulls: "last" } });
  });

  it.each(JOB_SORTS.flatMap((sort) => [1, 2, 3, 5].map((size) => [sort, size] as const)))(
    "%s pages of %i neither repeat nor skip a job",
    (sort, size) => {
      const { ordered, seen } = paginate(sort, size);
      expect(seen).toEqual(ordered);
    },
  );

  it("nothing follows the last row", () => {
    for (const sort of JOB_SORTS) {
      const last = [...rows].sort(compareJobs(sort)).at(-1)!;
      expect(rows.filter((r) => matches(afterCursor(sort, last), r))).toEqual([]);
    }
  });
});

describe("the sort param", () => {
  it("accepts each order except the default, which stays out of the URL", () => {
    expect(parseSearchParams({ sort: "newest" }).sort).toBe("newest");
    expect(parseSearchParams({ sort: "salary" }).sort).toBe("salary");
    expect(parseSearchParams({ sort: "recommended" }).sort).toBeUndefined();
    expect(parseSearchParams({}).sort).toBeUndefined();
  });

  it("falls back to the default on anything else", () => {
    expect(parseSearchParams({ sort: "cheapest" }).sort).toBeUndefined();
    expect(parseSearchParams({ sort: "" }).sort).toBeUndefined();
    expect(parseSearchParams({ sort: ["salary", "newest"] }).sort).toBe("salary");
    expect(parseSort({ sort: "SALARY" })).toBeUndefined();
    expect(parseSort({ sort: "salary" })).toBe("salary");
  });

  it("composes with the other filters in a link", () => {
    const params = parseSearchParams({ q: "react", city: "Pune", sort: "salary", cursor: "cm0abc123def456" });
    expect(toQueryString({ ...params, cursor: undefined })).toBe("?q=react&city=Pune&sort=salary");
  });
});
