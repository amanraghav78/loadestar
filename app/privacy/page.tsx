import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Company"
      title="Privacy"
      intro="Short version: an account is optional, and everything in yours is yours to delete."
    >
      <h3>Browsing without an account</h3>
      <ul>
        <li>
          <strong>Saved roles</strong> live in your browser&rsquo;s local storage. They never reach our servers
          except as a list of listing IDs when you open the Saved page.
        </li>
        <li>
          <strong>Apply clicks.</strong> When you click Apply we record the listing, the time, the page you came
          from (without query strings) and your country as reported by our host. Not your IP address. These counts
          are anonymous: nothing in them points to a person, and they are not linked to any account.
        </li>
        <li>
          <strong>Aggregate analytics.</strong> We use privacy-friendly, cookie-free page analytics to see which
          pages are used.
        </li>
      </ul>

      <h3>If you create an account</h3>
      <p>
        Signing in with Google is the only way in. Google tells us your name, email address and profile picture.
        We never receive your Google password, and we never post anything anywhere.
      </p>
      <ul>
        <li>
          <strong>Your profile.</strong> Anything you choose to add: phone number, city, years of experience,
          current job title, and links to LinkedIn, GitHub or your own site. All of it is optional.
        </li>
        <li>
          <strong>Your saved and applied roles.</strong> Once you sign in, saved roles sync to your account so they
          follow you between devices. &ldquo;Applied&rdquo; means you opened the employer&rsquo;s page from here —
          we can&rsquo;t see whether you finished their form.
        </li>
        <li>
          <strong>A session cookie</strong> so you stay signed in. It is strictly necessary and is not used for
          advertising or tracking.
        </li>
      </ul>

      <h3>Your resume</h3>
      <p>
        Your resume is stored in private file storage, encrypted at rest. It is not public, it is not linked from
        any shareable address, and it can only be downloaded by you while you are signed in. Replacing it deletes
        the previous file. We do not read it, and we do not send it, your profile or your contact details to any
        employer — applying still happens on the employer&rsquo;s own site.
      </p>

      <h3>What we don&rsquo;t do</h3>
      <ul>
        <li>We don&rsquo;t set advertising or tracking cookies.</li>
        <li>We don&rsquo;t sell or share your data with employers or third parties.</li>
        <li>We don&rsquo;t email you anything you didn&rsquo;t ask for.</li>
      </ul>

      <h3>Deleting your data</h3>
      <p>
        Delete your account yourself from your account page at any time. That removes your profile, your resume
        file, your saved roles and your applied roles. What remains is the anonymous apply-click count described
        above, which contains nothing that identifies you. Your sign-in session expires after 30 days; everything
        else is kept until you delete it.
      </p>
      <p>
        If you would rather we did it, or you want a copy of what we hold, write to{" "}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>

      <h3>Applications</h3>
      <p>
        Applying takes you to the employer&rsquo;s own site or form. Whatever you submit there is covered by that
        employer&rsquo;s privacy policy, not ours.
      </p>
    </ContentPage>
  );
}
