import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Verification policy",
  alternates: { canonical: "/employers/verification" },
};

export default function VerificationPage() {
  return (
    <ContentPage
      eyebrow="Employers"
      title="Verification policy"
      intro="How listings get onto Lodestar and how they stay accurate."
    >
      <h3>From your careers page</h3>
      <p>
        If your careers site runs on Workday, SmartRecruiters, Greenhouse, Lever, Ashby, Oracle Recruiting or
        Eightfold, we read its public listings directly. There&rsquo;s nothing to post or re-confirm: new roles
        appear after our next check (several times a day), and roles you close disappear from Lodestar on the same
        schedule. Roles are removed once they are 30 days old.
      </p>
      <h3>Publish your salary range</h3>
      <p>
        Roles with a published INR salary range are ranked first and marked on Lodestar. Add the annual range to
        the job description (for example &ldquo;CTC: ₹25&ndash;35 LPA&rdquo;), or use your applicant tracking
        system&rsquo;s pay-range field, and we&rsquo;ll pick it up.
      </p>
      <h3>Not on a supported job board?</h3>
      <p>
        Submit roles through the &ldquo;Post a role&rdquo; form. We check that the posting comes from someone at
        your company and that the application link goes to your own site or a form you control.
      </p>
      <h3>Corrections and removal</h3>
      <p>
        If something about your listing is wrong, or you&rsquo;d rather not appear on Lodestar, contact us and
        we&rsquo;ll fix or remove it within two working days.
      </p>
    </ContentPage>
  );
}
