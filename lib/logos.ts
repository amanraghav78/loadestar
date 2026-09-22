import bundled from "@/lib/company-logos.json";

const BUNDLED = new Set(bundled.slugs);

/**
 * A company's logo: the URL set in /admin if there is one, otherwise the
 * 112px tile that scripts/fetch-logos.ts saved in public/logos, otherwise
 * null (the avatar shows the company's initial).
 */
export function companyLogo(company: { slug: string; logoUrl?: string | null }) {
  if (company.logoUrl) return company.logoUrl;
  return BUNDLED.has(company.slug) ? `/logos/${company.slug}.webp` : null;
}
