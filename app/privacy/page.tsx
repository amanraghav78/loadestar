import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Company"
      title="Privacy"
      intro="Short version: we don't have accounts, so we don't have your personal data."
    >
      <h3>What we store</h3>
      <ul>
        <li>
          <strong>Saved roles</strong> live in your browser&rsquo;s local storage. They never reach our servers
          except as a list of listing IDs when you open the Saved page.
        </li>
        <li>
          <strong>Apply clicks.</strong> When you click Apply we record the listing, the time, the page you came
          from (without query strings) and your country as reported by our host. Not your IP address.
        </li>
        <li>
          <strong>Aggregate analytics.</strong> We use privacy-friendly, cookie-free page analytics to see which
          pages are used.
        </li>
      </ul>
      <h3>What we don&rsquo;t do</h3>
      <ul>
        <li>We don&rsquo;t set advertising or tracking cookies.</li>
        <li>We don&rsquo;t collect CVs, names or email addresses from candidates.</li>
        <li>We don&rsquo;t sell or share data with employers or third parties.</li>
      </ul>
      <h3>Applications</h3>
      <p>
        Applying takes you to the employer&rsquo;s own site or form. Whatever you submit there is covered by that
        employer&rsquo;s privacy policy, not ours.
      </p>
    </ContentPage>
  );
}
