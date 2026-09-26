import type { JobStatus } from "@/lib/generated/prisma/enums";

/**
 * Lodestar only keeps roles posted within the last 30 days. Older postings are
 * never imported, and the cleanup job deletes anything that ages past it.
 */
export const LISTING_MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Postings dated before this moment are too old to list. */
export function listingCutoff(now = new Date()) {
  return new Date(now.getTime() - LISTING_MAX_AGE_DAYS * DAY_MS);
}

/** The date a listing ages out and is deleted. */
export function listingExpiresAt(postedAt: Date) {
  return new Date(postedAt.getTime() + LISTING_MAX_AGE_DAYS * DAY_MS);
}

/**
 * A listing waiting on review, or one we turned down, is not a page (or a share
 * image): it would otherwise be readable by anyone holding the slug. Closed and
 * expired roles stay up, marked as no longer open, because people link to them.
 */
export function isListingPublic(status: JobStatus) {
  return status === "ACTIVE" || status === "CLOSED" || status === "EXPIRED";
}
