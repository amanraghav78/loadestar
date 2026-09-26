import { site } from "@/lib/site";
import { jsonLdScript, siteJsonLd } from "@/lib/structured-data";

/** WebSite (with a sitelinks search box) and Organization data. Static, so it renders into cached pages. */
export function SiteJsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd(site)) }} />;
}
