import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/queries";
import { getSessionUser } from "@/lib/session";

/**
 * Company reviews.
 *
 * Only approved reviews are ever read publicly, and the aggregate is worked out
 * from the same set — so a queued or rejected review moves no numbers. The public
 * read is cached and tagged with the company, which is what an approval in
 * /admin/moderation invalidates; the "your own review" read is per-person and
 * uncached, like everything else in lib/account-queries.ts.
 */

export const REVIEWS_SHOWN = 20;

export async function getCompanyReviews(companyId: string, slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.companies, TAGS.company(slug));

  const [reviews, aggregate] = await Promise.all([
    db.companyReview.findMany({
      where: { companyId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: REVIEWS_SHOWN,
      // No user fields: a review is shown by role, never by name.
      select: {
        id: true,
        rating: true,
        title: true,
        pros: true,
        cons: true,
        roleTitle: true,
        stillThere: true,
        createdAt: true,
      },
    }),
    db.companyReview.aggregate({
      where: { companyId, status: "APPROVED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  return {
    reviews,
    count: aggregate._count._all,
    // One decimal place is as much precision as a handful of ratings supports.
    average: aggregate._avg.rating == null ? null : Math.round(aggregate._avg.rating * 10) / 10,
  };
}

export type CompanyReviewView = Awaited<ReturnType<typeof getCompanyReviews>>["reviews"][number];

/**
 * This visitor's own review of the company, whatever state it is in, so the page
 * can show them their queued or rejected one instead of an empty form.
 */
export async function getMyReview(companyId: string) {
  const user = await getSessionUser();
  if (!user) return null;
  return db.companyReview.findUnique({
    where: { companyId_userId: { companyId, userId: user.id } },
    select: {
      rating: true,
      title: true,
      pros: true,
      cons: true,
      roleTitle: true,
      stillThere: true,
      status: true,
      reviewNote: true,
    },
  });
}

export type MyReview = NonNullable<Awaited<ReturnType<typeof getMyReview>>>;
