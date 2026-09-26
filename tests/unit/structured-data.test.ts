import { describe, expect, it } from "vitest";
import { jsonLdScript, siteJsonLd } from "@/lib/structured-data";

const site = { name: "Lodestar", url: "https://loadestar.vercel.app", description: "Real tech jobs across India." };

describe("siteJsonLd", () => {
  const data = siteJsonLd(site);
  const [website, org] = data["@graph"];

  it("describes the site with a search box that lands on /jobs?q=", () => {
    expect(data["@context"]).toBe("https://schema.org");
    expect(website).toMatchObject({
      "@type": "WebSite",
      name: "Lodestar",
      url: "https://loadestar.vercel.app/",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://loadestar.vercel.app/jobs?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    });
  });

  it("names the organization, with an absolute logo URL, and links it as publisher", () => {
    expect(org).toEqual({
      "@type": "Organization",
      "@id": "https://loadestar.vercel.app/#organization",
      name: "Lodestar",
      url: "https://loadestar.vercel.app/",
      logo: "https://loadestar.vercel.app/logo.png",
    });
    expect(website).toHaveProperty("publisher", { "@id": org!["@id"] });
  });

  it("keeps URLs absolute whatever the configured site URL looks like", () => {
    const local = siteJsonLd({ ...site, url: "http://localhost:3000/" });
    expect(local["@graph"][0]).toHaveProperty(
      "potentialAction.target.urlTemplate",
      "http://localhost:3000/jobs?q={search_term_string}",
    );
    expect(local["@graph"][1]).toHaveProperty("logo", "http://localhost:3000/logo.png");
  });
});

describe("jsonLdScript", () => {
  it("escapes < so the JSON cannot close its script tag", () => {
    const out = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
