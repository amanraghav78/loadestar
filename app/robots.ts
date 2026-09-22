import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/apply/", "/api/", "/saved", "/account", "/sign-in"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
