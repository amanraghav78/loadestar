import { env } from "@/lib/env";

export const site = {
  name: "Lodestar",
  tagline: "Salary-transparent hiring for product and engineering teams.",
  description:
    "Lodestar indexes engineering, design and product roles from companies that publish their salary bands. No recruiter spam, no ghost listings.",
  url: env.NEXT_PUBLIC_SITE_URL,
  postRoleFormUrl: env.NEXT_PUBLIC_POST_ROLE_FORM_URL,
  contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL,
  /** Listings unconfirmed for this many days are expired by the cron job. */
  expiryDays: 30,
};

export function absoluteUrl(path = "/") {
  return new URL(path, site.url).toString();
}
