import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Verification policy",
  alternates: { canonical: "/employers/verification" },
};

export default function VerificationPage() {
  return (
    <ContentPage eyebrow="Employers" title="Verification policy" intro="How we keep every listing real.">
      <ul>
        <li>Every job must be a real, open position at the company that is hiring.</li>
        <li>The apply link must go to your own site or a form you control.</li>
        <li>Filled roles come down, and every listing is removed once it is 30 days old.</li>
        <li>Publish an annual salary range in rupees and your job is ranked first.</li>
      </ul>
      <h2>Corrections and removal</h2>
      <p>
        If something about your listing is wrong, or you&rsquo;d rather not appear on Lodestar, contact us and
        we&rsquo;ll fix or remove it within two working days.
      </p>
    </ContentPage>
  );
}
