/**
 * Site-level schema.org data for the home page: the site itself, with a
 * search box Google can offer in results, and the organization behind it.
 * Pure, so it can be unit-tested; components/site-json-ld.tsx renders it.
 */

type SiteInfo = { name: string; url: string; description: string };

/** Where the Organization logo is served from (public/logo.png, 512×512). */
export const LOGO_PATH = "/logo.png";

export function siteJsonLd(site: SiteInfo) {
  const url = new URL("/", site.url).toString();
  const orgId = `${url}#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: site.name,
        url,
        description: site.description,
        inLanguage: "en-IN",
        publisher: { "@id": orgId },
        potentialAction: {
          "@type": "SearchAction",
          // /jobs reads the keywords from `q` (see lib/validators.ts).
          target: { "@type": "EntryPoint", urlTemplate: `${new URL("/jobs", site.url)}?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": orgId,
        name: site.name,
        url,
        logo: new URL(LOGO_PATH, site.url).toString(),
      },
    ],
  };
}

/** JSON for a `<script type="application/ld+json">`; "<" is escaped so it cannot close the tag. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
