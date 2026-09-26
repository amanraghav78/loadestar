import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of service", alternates: { canonical: "/terms" } };

/** Last substantive change to these terms, shown so readers can tell if they are current. */
const UPDATED = "22 September 2026";

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Company"
      title="Terms of service"
      intro={`The rules for using ${site.name}. Plain terms, and short enough to read.`}
    >
      <p>
        By using {site.name} you agree to what follows. If you don&rsquo;t, please don&rsquo;t use the site. These terms
        were last updated on {UPDATED}.
      </p>

      <h2>What Lodestar is</h2>
      <p>
        We list jobs at other companies. We are not an employer, a recruiter or an agent, and we are not part of any
        hiring decision. Applying takes you to the employer&rsquo;s own site, and everything after that is between you
        and them — including their terms, their privacy policy and their decision.
      </p>

      <h2>Using the site as a candidate</h2>
      <ul>
        <li>An account is optional, and one account belongs to one person.</li>
        <li>
          What you put in your profile should be true. Inventing experience or qualifications wastes an employer&rsquo;s
          time and yours.
        </li>
        <li>
          Don&rsquo;t scrape the listings, resell them, or hit the site with automated traffic. If you want the data,{" "}
          <a href={`mailto:${site.contactEmail}`}>ask us</a>.
        </li>
        <li>You can delete your account, and everything in it, whenever you like.</li>
      </ul>

      <h2>Posting a role</h2>
      <ul>
        <li>
          Post only roles you are actually hiring for, at the company you told us you work for. Every band must be a
          real one you would honour.
        </li>
        <li>
          A listing without a published salary range does not go live. Neither do adverts for training, unpaid
          &ldquo;opportunities&rdquo;, franchises, or anything that asks a candidate for money.
        </li>
        <li>
          We review submissions before they publish, and we may edit a listing for length or clarity, refuse it, or take
          it down later. Roles need confirming every {site.expiryDays} days or they come down on their own.
        </li>
        <li>You are responsible for your listing being lawful, accurate and free of discriminatory requirements.</li>
      </ul>

      <h2>Reviews</h2>
      <p>
        Reviews must describe your own first-hand experience of working somewhere. They are checked by a person before
        they appear. We remove anything that names an individual, reveals confidential information, or reads as
        harassment rather than an account of a job — and we may remove a review without explaining why. A review is the
        author&rsquo;s opinion, not ours.
      </p>

      <h2>What we can&rsquo;t promise</h2>
      <p>
        Listings come from employers and their job feeds, and we verify what we reasonably can. Even so, we can&rsquo;t
        promise every listing is current, complete or accurate, that the site is always available, or that you will hear
        back from anyone. The site is provided as it is, and we are not liable for a loss that follows from using it —
        whether that is a role that turned out to be filled, or an application nobody answered.
      </p>

      <h2>Your content</h2>
      <p>
        What you write stays yours. By posting a listing or a review you give us permission to show it on the site and
        in search results, and to keep showing it if you later delete your account — a review still attributed to nobody
        in particular. Deleting your account removes your profile, resume and saved roles as described in our{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>Suspension</h2>
      <p>
        We can suspend an account or remove content that breaks these terms, with notice where it is practical to give
        it. Serious cases — fraudulent listings, harvesting candidate data, abuse of a reviewer — get no notice.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts at Bengaluru have exclusive jurisdiction over any
        dispute arising from them.
      </p>

      <h2>Changes</h2>
      <p>
        We will update this page when the terms change, and the date at the top with it. Continuing to use the site
        after a change means you accept the new version.
      </p>

      <h2>Getting in touch</h2>
      <p>
        Questions about these terms: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>
    </ContentPage>
  );
}
