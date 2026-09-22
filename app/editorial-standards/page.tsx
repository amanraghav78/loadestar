import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Editorial standards",
  alternates: { canonical: "/editorial-standards" },
};

export default function EditorialStandardsPage() {
  return (
    <ContentPage eyebrow="Company" title="Editorial standards" intro="What makes it onto Lodestar.">
      <h3>What we list</h3>
      <ul>
        <li>Engineering, design, product, data, security and infrastructure roles.</li>
        <li>Based in India, or remote and open to candidates in India.</li>
        <li>Real, open positions at the hiring company. No agencies, no reposts.</li>
        <li>Nothing older than 30 days.</li>
      </ul>
      <h3>Pay</h3>
      <ul>
        <li>We show a salary only when the company states it in rupees, per year.</li>
        <li>We never estimate or guess pay.</li>
      </ul>
      <h3>Something wrong?</h3>
      <p>
        If a job is filled, misleading or the link is broken, tell us through the contact page and we&rsquo;ll fix
        it.
      </p>
    </ContentPage>
  );
}
