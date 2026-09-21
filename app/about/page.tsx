import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      title="A job board that respects your evenings."
      intro="Lodestar lists product, design and engineering roles from companies willing to say what the job pays."
    >
      <p>
        Most job searches waste hours on listings that were never going to work out: bands far below
        what you earn now, roles filled months ago, recruiters fronting for companies they won&rsquo;t name.
        Lodestar exists to remove those hours.
      </p>
      <h3>How it works</h3>
      <ul>
        <li>Every listing publishes a salary band. No band, no listing.</li>
        <li>Employers re-confirm each role weekly. Unconfirmed roles are taken down after 30 days.</li>
        <li>You apply directly on the company&rsquo;s own site. We never sit between you and the hiring team.</li>
      </ul>
      <h3>No accounts</h3>
      <p>
        You don&rsquo;t need to sign up to use Lodestar. Saved roles are stored in your browser, and we
        don&rsquo;t collect CVs, emails or profiles.
      </p>
    </ContentPage>
  );
}
