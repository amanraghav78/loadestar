import { OG_CONTENT_TYPE, OG_SIZE, SITE_OG_ALT, siteImage } from "@/lib/og";

/** The default share image for every page without its own. */
export const alt = SITE_OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return siteImage();
}
