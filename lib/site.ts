import { env } from "@/lib/env";

export const site = {
  name: "Lodestar",
  tagline: "Tech jobs in India, straight from company careers pages.",
  description:
    "Lodestar lists engineering, design, product and data roles at companies hiring in India, pulled daily from their own careers pages. Pay first whenever it’s published. No recruiter spam, no ghost listings.",
  url: env.NEXT_PUBLIC_SITE_URL,
  postRoleFormUrl: env.NEXT_PUBLIC_POST_ROLE_FORM_URL,
  contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL,
  /** Listings unconfirmed for this many days are expired by the cron job. */
  expiryDays: 30,
};

export function absoluteUrl(path = "/") {
  return new URL(path, site.url).toString();
}
