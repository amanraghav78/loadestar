import type { MetadataRoute } from "next";
import { authEnabled } from "@/lib/auth";
import { getSitemapData } from "@/lib/queries";
import { absoluteUrl } from "@/lib/site";

const STATIC_PATHS = [
  "/",
  "/jobs",
  "/companies",
  "/salaries",
  "/about",
  "/editorial-standards",
  "/privacy",
  "/terms",
  "/contact",
  "/employers/pricing",
  "/employers/verification",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { jobs, companies } = await getSitemapData();
  return [
    ...STATIC_PATHS.map((p) => ({ url: absoluteUrl(p) })),
    // The employer pages only exist once accounts are switched on.
    ...(authEnabled ? [{ url: absoluteUrl("/employers/post") }] : []),
    ...companies.map((c) => ({ url: absoluteUrl(`/companies/${c.slug}`), lastModified: c.updatedAt })),
    ...jobs.map((j) => ({ url: absoluteUrl(`/jobs/${j.slug}`), lastModified: j.lastVerifiedAt })),
  ];
}
