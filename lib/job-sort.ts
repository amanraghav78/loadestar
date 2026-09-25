import type { Prisma } from "@/lib/generated/prisma/client";
import type { Currency } from "@/lib/generated/prisma/enums";

/**
 * How a list of jobs can be ordered, and the keyset pagination that goes with
 * each order. Pure (no database, no `server-only`) so the ordering rules can
 * be unit-tested on their own.
 *
 * - `recommended` (the default): roles that publish pay first, then newest —
 *   the promise on /about ("when a company publishes the salary, you see it first").
 * - `newest`: most recently posted first.
 * - `salary`: highest published pay first. INR bands lead (this is an India
 *   board), then USD, GBP and EUR, each ranked within itself rather than
 *   converted; roles without a published band come last, newest first.
 *
 * Every order ends on `id`, so it is total and a page boundary never
 * duplicates or skips a job.
 */
export const JOB_SORTS = ["recommended", "newest", "salary"] as const;
export type JobSort = (typeof JOB_SORTS)[number];

export const DEFAULT_SORT: JobSort = "recommended";

export const SORT_LABEL: Record<JobSort, string> = {
  recommended: "Recommended",
  newest: "Newest",
  salary: "Highest salary",
};

/** The columns an order reads, and therefore what a cursor row must carry. */
export type SortRow = {
  id: string;
  postedAt: Date;
  salaryDisclosed: boolean;
  currency: Currency | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

export const sortRowSelect = {
  id: true,
  postedAt: true,
  salaryDisclosed: true,
  currency: true,
  salaryMin: true,
  salaryMax: true,
} satisfies Prisma.JobSelect;

type Field = keyof SortRow;

type SortKey = {
  field: Field;
  dir: "asc" | "desc";
  /** Nullable columns always put nulls last, whatever the direction. */
  nullable?: boolean;
  /**
   * For booleans and enums, every value in ascending order. Prisma can't
   * compare these with lt/gt, so "after" becomes "one of the values after".
   */
  domain?: readonly (string | boolean)[];
};

/**
 * Postgres orders an enum by the order its values were created, which for
 * `Currency` is not schema.prisma's: INR was appended by migration 0002. The
 * keyset must use the database's order or pages skip rows, so it is spelled out
 * here (tests/unit/job-sort.test.ts checks it against the migrations).
 * Sorted descending this puts INR first, then USD, GBP, EUR.
 */
export const CURRENCY_DB_ORDER = ["EUR", "GBP", "USD", "INR"] as const satisfies readonly Currency[];

const salaryDisclosed: SortKey = { field: "salaryDisclosed", dir: "desc", domain: [false, true] };
const postedAt: SortKey = { field: "postedAt", dir: "desc" };
const id: SortKey = { field: "id", dir: "desc" };

const SORT_KEYS: Record<JobSort, SortKey[]> = {
  recommended: [salaryDisclosed, postedAt, id],
  newest: [postedAt, id],
  salary: [
    salaryDisclosed,
    { field: "currency", dir: "desc", nullable: true, domain: CURRENCY_DB_ORDER },
    { field: "salaryMax", dir: "desc", nullable: true },
    { field: "salaryMin", dir: "desc", nullable: true },
    postedAt,
    id,
  ],
};

/** Prisma `orderBy` for a sort. */
export function orderByFor(sort: JobSort): Prisma.JobOrderByWithRelationInput[] {
  return SORT_KEYS[sort].map(({ field, dir, nullable }) =>
    nullable ? { [field]: { sort: dir, nulls: "last" } } : { [field]: dir },
  );
}

/** `field` equals the cursor's value (a null is matched as null). */
function equal(key: SortKey, value: SortRow[Field]): Prisma.JobWhereInput {
  return { [key.field]: value };
}

/** `field` sorts strictly after the cursor's value, or null when nothing can. */
function after(key: SortKey, value: SortRow[Field]): Prisma.JobWhereInput | null {
  // Nulls are last, so nothing comes after one within this key.
  if (value === null) return null;

  const options: Prisma.JobWhereInput[] = [];
  if (key.domain) {
    const i = key.domain.indexOf(value as string | boolean);
    const later = key.dir === "asc" ? key.domain.slice(i + 1) : key.domain.slice(0, i).reverse();
    if (later.length === 1) options.push({ [key.field]: later[0] });
    else if (later.length > 1) options.push({ [key.field]: { in: later } });
  } else {
    options.push({ [key.field]: { [key.dir === "asc" ? "gt" : "lt"]: value } });
  }
  if (key.nullable) options.push({ [key.field]: null });

  if (options.length === 0) return null;
  return options.length === 1 ? options[0]! : { OR: options };
}

/**
 * Keyset condition for "every row after `cursor` in this order": for some key,
 * all earlier keys tie and that key is strictly later. Unlike Prisma's own
 * `cursor`, this handles nullable columns and a cursor job that has since
 * closed or no longer matches the filters.
 */
export function afterCursor(sort: JobSort, cursor: SortRow): Prisma.JobWhereInput {
  const keys = SORT_KEYS[sort];
  const branches: Prisma.JobWhereInput[] = [];
  keys.forEach((key, i) => {
    const later = after(key, cursor[key.field]);
    if (!later) return;
    const ties = keys.slice(0, i).map((k) => equal(k, cursor[k.field]));
    branches.push(ties.length ? { AND: [...ties, later] } : later);
  });
  // An empty OR matches nothing, which is right: the cursor was the last row.
  return { OR: branches };
}

/** The same order as `orderByFor`, in memory. */
export function compareJobs(sort: JobSort) {
  const keys = SORT_KEYS[sort];
  return (a: SortRow, b: SortRow) => {
    for (const key of keys) {
      const x = a[key.field];
      const y = b[key.field];
      if (x === y || (x instanceof Date && y instanceof Date && x.getTime() === y.getTime())) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      const rank = (v: NonNullable<typeof x>) =>
        key.domain ? key.domain.indexOf(v as string | boolean) : v instanceof Date ? v.getTime() : v;
      const rx = rank(x);
      const ry = rank(y);
      const cmp = rx < ry ? -1 : rx > ry ? 1 : 0;
      if (cmp !== 0) return key.dir === "asc" ? cmp : -cmp;
    }
    return 0;
  };
}

/** The sort to use: the one asked for, or the default. */
export function resolveSort(sort: JobSort | undefined): JobSort {
  return sort ?? DEFAULT_SORT;
}
