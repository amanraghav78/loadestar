import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = { title: "Pricing", alternates: { canonical: "/employers/pricing" } };

export default function PricingPage() {
  return (
    <ContentPage
      eyebrow="Employers"
      title="Pricing"
      intro="Posting on Lodestar is free while we launch."
    >
      <p>
        Every listing that meets our editorial standards goes live at no cost. Featured placement on the home
        page and volume plans for teams hiring for many roles are coming later. If you&rsquo;re interested,{" "}
        <Link href="/contact" className="text-fg underline underline-offset-4">
          get in touch
        </Link>
        .
      </p>
      <h3>What&rsquo;s included</h3>
      <ul>
        <li>A listing with your published salary band, live until you mark it filled</li>
        <li>A company profile page with all your open roles</li>
        <li>Monthly counts of how many candidates clicked through to apply</li>
      </ul>
    </ContentPage>
  );
}
