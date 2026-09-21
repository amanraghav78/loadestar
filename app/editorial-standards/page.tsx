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
      intro="What gets listed, how we read it, and when it comes down."
    >
      <h3>What we list</h3>
      <ul>
        <li>Engineering, design, product, data, security and infrastructure roles.</li>
        <li>Based in an Indian city, or remote and explicitly open to candidates in India.</li>
        <li>Published by the hiring company itself on its own job board. No agencies, no reposts.</li>
      </ul>
      <h3>How we handle pay</h3>
      <ul>
        <li>We show a salary only when the posting states it in rupees, per year.</li>
        <li>
          A US or European range on a multi-country posting is never shown on the Indian role; it
          doesn&rsquo;t apply there.
        </li>
        <li>Monthly stipends, company revenue figures and loan amounts are not salaries, and we don&rsquo;t treat them as such.</li>
        <li>Where no INR salary is published, the listing says &ldquo;Salary not disclosed&rdquo;.</li>
      </ul>
      <h3>When a listing comes down</h3>
      <p>
        We re-read every company&rsquo;s careers page daily. A role that is no longer there is taken down on the
        next check. If you find a listing that&rsquo;s wrong, such as a filled role, a misread salary or a
        broken link, tell us through the contact page and we&rsquo;ll fix it.
      </p>
    </ContentPage>
  );
}
