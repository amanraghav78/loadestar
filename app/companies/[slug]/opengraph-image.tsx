import { getCompanyBySlug } from "@/lib/queries";
import { companyImage, OG_CONTENT_TYPE, OG_SIZE, SITE_OG_ALT, siteImage } from "@/lib/og";
import { companyOgContent } from "@/lib/og-data";

/** The same cached read as the page (default order), so the image costs no extra query. */
async function company(slug: string | undefined) {
  // The build asks for the image ids before any slug is known.
  if (!slug) return null;
  const found = await getCompanyBySlug(slug).catch(() => null);
  return found ? companyOgContent({ name: found.name, openRoles: found.jobs.length }) : null;
}

/** One image per company; this is where its alt text comes from. */
export async function generateImageMetadata({ params }: { params?: { slug?: string } }) {
  const found = await company(params?.slug);
  return [{ id: "card", alt: found?.alt ?? SITE_OG_ALT, size: OG_SIZE, contentType: OG_CONTENT_TYPE }];
}

/** An unknown company gets the site image rather than an error. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const found = await company((await params).slug);
  return found ? companyImage(found) : siteImage();
}
