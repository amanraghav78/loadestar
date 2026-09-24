import Link from "next/link";
import { Star } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { authEnabled } from "@/lib/auth";
import { formatPostedAgo } from "@/lib/format";
import { getCompanyReviews, getMyReview, type CompanyReviewView } from "@/lib/reviews";
import { getSessionUser } from "@/lib/session";
import { ReviewForm } from "./review-form";

/**
 * Reviews of one company: the published ones, and whatever this visitor can do
 * next — write one, see their queued one, or sign in.
 *
 * The published list and the "your own review" part are read separately on
 * purpose: the first is shared and cached, the second is per-person and must not
 * be. This whole section renders inside the page's own <Suspense> boundary.
 */
export async function ReviewsSection({
  companyId,
  slug,
  companyName,
}: {
  companyId: string;
  slug: string;
  companyName: string;
}) {
  const { reviews, count, average } = await getCompanyReviews(companyId, slug);

  return (
    <section className="mt-12" aria-labelledby="reviews">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="reviews" className="text-fg text-lg font-semibold">
          Working at {companyName}
        </h2>
        {count > 0 && average != null && (
          <p className="text-muted flex items-center gap-1.5 text-sm">
            <Star className="fill-accent-fg text-accent-fg size-4" aria-hidden />
            <span className="text-fg font-medium tabular-nums">{average.toFixed(1)}</span>
            <span className="tabular-nums">
              ({count} {count === 1 ? "review" : "reviews"})
            </span>
          </p>
        )}
      </div>

      {count === 0 && (
        <p className="text-muted mt-2 text-sm">
          No reviews yet. If you&rsquo;ve worked here, yours would be the first.
        </p>
      )}

      {reviews.length > 0 && (
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="flex">
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      )}

      {authEnabled && (
        <div className="metal mt-8 rounded-3xl p-6 sm:p-8">
          <YourReview companyId={companyId} companyName={companyName} slug={slug} />
        </div>
      )}
    </section>
  );
}

async function YourReview({ companyId, companyName, slug }: { companyId: string; companyName: string; slug: string }) {
  const user = await getSessionUser();

  if (!user) {
    return (
      <>
        <h3 className="text-fg text-[15px] font-semibold">Worked here?</h3>
        <p className="text-muted mt-2 mb-6 max-w-md text-sm">
          Sign in to review {companyName}. Reviews are shown by role, never by name.
        </p>
        <div className="max-w-xs">
          <GoogleSignIn next={`/companies/${slug}`} />
        </div>
      </>
    );
  }

  const mine = await getMyReview(companyId);

  if (mine?.status === "PENDING") {
    return (
      <>
        <h3 className="text-fg text-[15px] font-semibold">Your review is with us</h3>
        <p className="text-muted mt-2 text-sm">
          We read every review before it appears — usually within a working day.
        </p>
        <details className="mt-4">
          <summary className="text-muted hover:text-fg cursor-pointer text-sm">Edit it instead</summary>
          <div className="mt-5">
            <ReviewForm companyId={companyId} companyName={companyName} mine={mine} />
          </div>
        </details>
      </>
    );
  }

  return (
    <>
      <h3 className="text-fg text-[15px] font-semibold">
        {mine?.status === "APPROVED" ? "Your review" : mine ? "Your review wasn't published" : `Review ${companyName}`}
      </h3>
      {mine?.status === "REJECTED" && (
        <p className="text-muted mt-2 max-w-md text-sm">
          {mine.reviewNote ?? "It didn't meet our review guidelines."} You can rewrite it below — see our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            terms
          </Link>
          .
        </p>
      )}
      {!mine && (
        <p className="text-muted mt-2 max-w-md text-sm">
          Only your own first-hand experience, please. Your name is never shown.
        </p>
      )}
      <div className="mt-6">
        <ReviewForm companyId={companyId} companyName={companyName} mine={mine} />
      </div>
    </>
  );
}

function ReviewCard({ review }: { review: CompanyReviewView }) {
  return (
    <article className="metal flex flex-1 flex-col rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Stars rating={review.rating} />
        <h3 className="text-fg min-w-0 flex-1 text-[15px] leading-snug font-semibold">{review.title}</h3>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-subtle text-xs font-medium tracking-[0.08em] uppercase">What works</dt>
          <dd className="text-muted mt-1 leading-relaxed">{review.pros}</dd>
        </div>
        <div>
          <dt className="text-subtle text-xs font-medium tracking-[0.08em] uppercase">What doesn&rsquo;t</dt>
          <dd className="text-muted mt-1 leading-relaxed">{review.cons}</dd>
        </div>
      </dl>

      <p className="text-subtle mt-4 text-xs">
        {review.roleTitle ?? "Employee"}
        {review.stillThere ? " · still there" : " · former employee"} ·{" "}
        <time dateTime={review.createdAt.toISOString()}>{formatPostedAgo(review.createdAt)}</time>
      </p>
    </article>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <p className="flex shrink-0 items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`size-3.5 ${value <= rating ? "fill-accent-fg text-accent-fg" : "text-line-strong"}`}
          aria-hidden
        />
      ))}
    </p>
  );
}
