import "server-only";
import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/queries";

/** Stale-while-revalidate invalidation after any job write. */
export function revalidateJobs(slugs: string[] = []) {
  revalidateTag(TAGS.jobs, "max");
  for (const slug of slugs) revalidateTag(TAGS.job(slug), "max");
}

export function revalidateCompanies(slugs: string[] = []) {
  revalidateTag(TAGS.companies, "max");
  for (const slug of slugs) revalidateTag(TAGS.company(slug), "max");
}
