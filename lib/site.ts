import { env } from "@/lib/env";
import { LISTING_MAX_AGE_DAYS } from "@/lib/listing-age";

export const site = {
  name: "Lodestar",
  tagline: "Your Next Job Awaits.",
  description:
    "Lodestar lists thousands of engineering, design, product and data roles at MNCs and startups hiring in India, pulled daily from their own careers pages. Only roles posted in the last 30 days. Pay first whenever it’s published.",
  url: env.NEXT_PUBLIC_SITE_URL,
  postRoleFormUrl: env.NEXT_PUBLIC_POST_ROLE_FORM_URL,
  contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL,
  /** Roles are deleted once they are this many days old. */
  expiryDays: LISTING_MAX_AGE_DAYS,
};

export function absoluteUrl(path = "/") {
  return new URL(path, site.url).toString();
}
