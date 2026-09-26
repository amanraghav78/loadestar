import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <ContentPage
      eyebrow="Company"
      title="Contact"
      intro="Questions about a listing, posting roles, or reporting something that breaks our standards."
    >
      <p>
        Email us at{" "}
        <a href={`mailto:${site.contactEmail}`} className="text-fg underline underline-offset-4">
          {site.contactEmail}
        </a>
        . We reply within two working days.
      </p>
      <h2>Reporting a listing</h2>
      <p>
        Include the listing URL and what&rsquo;s wrong with it: a missing or misleading band, a filled role, or a broken
        application link. We review every report.
      </p>
    </ContentPage>
  );
}
