import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      title="Tech jobs in India, without the noise."
      intro="Lodestar lists engineering, design, product and data roles at companies hiring in India, taken straight from their own careers pages."
    >
      <p>
        Job hunting in India wastes hours on listings that were never real: roles filled months ago, recruiters
        reposting the same opening under different names, and no idea what a job pays until the final round.
        Lodestar is built to remove those hours.
      </p>
      <h3>Where the listings come from</h3>
      <ul>
        <li>
          Every role is read from the company&rsquo;s own careers site (the same listings you&rsquo;d see there),
          from MNCs like Microsoft, Amazon, NVIDIA and JPMorgan to startups like CRED and Razorpay. Nothing is
          scraped from other job sites or reposted by agencies.
        </li>
        <li>
          We check every company several times a day. When a role disappears from their careers page, it comes
          down here.
        </li>
        <li>Only roles posted in the last 30 days are listed. Anything older is deleted.</li>
        <li>We only list roles based in India, or explicitly open to remote work from India.</li>
      </ul>
      <h3>Pay first</h3>
      <p>
        Most Indian employers still don&rsquo;t publish salaries. When a company does, in rupees, on the
        posting, we show it in LPA and rank that role first. When it doesn&rsquo;t, the listing says
        &ldquo;Salary not disclosed&rdquo;. We never estimate or guess.
      </p>
      <h3>No accounts</h3>
      <p>
        You don&rsquo;t need to sign up. Saved roles stay in your browser, applications go directly to the
        company, and we don&rsquo;t collect CVs, emails or profiles.
      </p>
    </ContentPage>
  );
}
