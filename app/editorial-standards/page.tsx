import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Editorial standards",
  alternates: { canonical: "/editorial-standards" },
};

export default function EditorialStandardsPage() {
  return (
    <ContentPage
      eyebrow="Company"
      title="Editorial standards"
      intro="The rules every listing has to meet before it goes live, and what makes us take one down."
    >
      <h3>What every listing must include</h3>
      <ul>
        <li>An annual salary band with both a minimum and a maximum, in the currency the role is paid in.</li>
        <li>The real employer&rsquo;s name. We don&rsquo;t accept anonymous or agency listings.</li>
        <li>A working application link on the employer&rsquo;s own domain, or a form the employer controls.</li>
        <li>An honest location: on-site, hybrid, or remote with the regions it&rsquo;s open to.</li>
      </ul>
      <h3>What we reject</h3>
      <ul>
        <li>Bands so wide they tell you nothing, e.g. a maximum more than double the minimum.</li>
        <li>&ldquo;Competitive&rdquo;, &ldquo;DOE&rdquo; or other placeholders instead of numbers.</li>
        <li>Evergreen or pipeline roles that aren&rsquo;t being actively hired for.</li>
      </ul>
      <h3>When a listing comes down</h3>
      <p>
        Listings are removed when the employer marks them filled, or automatically when they haven&rsquo;t been
        re-confirmed for 30 days. If you find a listing that breaks these rules, tell us through the contact page
        and we&rsquo;ll review it within two working days.
      </p>
    </ContentPage>
  );
}
