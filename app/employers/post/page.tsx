import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ContentPage } from "@/components/content-page";
import { buttonClass } from "@/components/ui/button";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Post a role", alternates: { canonical: "/employers/post" } };

export default function PostRolePage() {
  return (
    <ContentPage
      eyebrow="Employers"
      title="Post a role"
      intro="Tell us about the role through our submission form. We review every submission against our editorial standards, usually within one working day."
    >
      <a href={site.postRoleFormUrl} target="_blank" rel="noopener" className={buttonClass("primary", "md")}>
        Open the submission form <ArrowUpRight className="size-4" aria-hidden />
      </a>
      <h3>Have these ready</h3>
      <ul>
        <li>Job title, level and discipline</li>
        <li>The annual salary band, minimum and maximum</li>
        <li>Location and remote policy, including the regions a remote role is open to</li>
        <li>The link candidates should apply through: your careers page or a form you control</li>
        <li>A description of the work, the team and the interview process</li>
      </ul>
      <p>
        Before submitting, read our{" "}
        <Link href="/editorial-standards" className="text-fg underline underline-offset-4">
          editorial standards
        </Link>{" "}
        and{" "}
        <Link href="/employers/verification" className="text-fg underline underline-offset-4">
          verification policy
        </Link>
        .
      </p>
    </ContentPage>
  );
}
