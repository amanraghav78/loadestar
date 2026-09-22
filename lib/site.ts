import { env } from "@/lib/env";
import { LISTING_MAX_AGE_DAYS } from "@/lib/listing-age";

export const site = {
  name: "Lodestar",
  tagline: "Your Next Job Awaits.",
  /** The one line under the tagline. */
  promise: "Only real jobs. No spam.",
  description:
    "Thousands of real tech jobs across India: engineering, data, product and design roles at top MNCs and startups. No spam.",
  url: env.NEXT_PUBLIC_SITE_URL,
  postRoleFormUrl: env.NEXT_PUBLIC_POST_ROLE_FORM_URL,
  contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL,
  /** Roles are deleted once they are this many days old. */
  expiryDays: LISTING_MAX_AGE_DAYS,
};

export function absoluteUrl(path = "/") {
  return new URL(path, site.url).toString();
}
