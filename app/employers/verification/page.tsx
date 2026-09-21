import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Verification policy",
  alternates: { canonical: "/employers/verification" },
};

export default function VerificationPage() {
  return (
    <ContentPage
      eyebrow="Employers"
      title="Verification policy"
      intro="How we check employers when they join, and how listings stay current."
    >
      <h3>When you first post</h3>
      <ul>
        <li>The submission must come from an email address on the company&rsquo;s own domain.</li>
        <li>The application link must point to your domain, your applicant tracking system, or a form you own.</li>
        <li>We check the salary band against the level and location. Bands that look implausible are sent back.</li>
      </ul>
      <h3>Keeping listings live</h3>
      <p>
        Each week we ask you to confirm your roles are still open. A listing that isn&rsquo;t confirmed for{" "}
        {site.expiryDays} days is taken down automatically and shown to candidates who saved it as closed.
      </p>
      <h3>Response times</h3>
      <p>
        Company pages show your median time to first reply. Candidates notice it, so replying quickly (even with a
        no) pays off.
      </p>
    </ContentPage>
  );
}
