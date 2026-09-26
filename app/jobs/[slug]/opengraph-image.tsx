import { getJobBySlug } from "@/lib/queries";
import { isListingPublic } from "@/lib/listing-age";
import { jobImage, OG_CONTENT_TYPE, OG_SIZE, SITE_OG_ALT, siteImage } from "@/lib/og";
import { jobOgContent } from "@/lib/og-data";

/** The same cached read as the page, so sharing a job costs no extra query. */
async function publicJob(slug: string | undefined) {
  // The build asks for the image ids before any slug is known.
  if (!slug) return null;
  const job = await getJobBySlug(slug).catch(() => null);
  return job && isListingPublic(job.status) ? job : null;
}

/** One image per job; this is where its alt text, which names the role, comes from. */
export async function generateImageMetadata({ params }: { params?: { slug?: string } }) {
  const job = await publicJob(params?.slug);
  return [{ id: "card", alt: job ? jobOgContent(job).alt : SITE_OG_ALT, size: OG_SIZE, contentType: OG_CONTENT_TYPE }];
}

/** A job that is unknown, or not public, gets the site image rather than an error. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const job = await publicJob((await params).slug);
  return job ? jobImage(jobOgContent(job)) : siteImage();
}
