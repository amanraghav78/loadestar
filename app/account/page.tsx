import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProfile } from "@/lib/account-queries";
import { authEnabled } from "@/lib/auth";
import { requireUserPage } from "@/lib/session";
import { resumeUploadEnabled } from "@/lib/storage";
import { SignOutButton } from "@/components/sign-out-button";
import { Container } from "@/components/ui/container";
import { AccountTabs } from "./account-tabs";
import { DeleteAccount } from "./delete-account";
import { ProfileSection } from "./profile-section";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  if (!authEnabled) notFound();

  return (
    <Container className="py-10">
      <AccountTabs current="/account" />
      <h1 className="steel-text text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Your account</h1>
      <p className="text-muted mt-2 text-sm">Your details and resume, kept private.</p>

      {/* Everything below reads the session, so it streams in behind the boundary. */}
      <Suspense fallback={<div className="bg-tint mt-10 h-96 animate-pulse rounded-3xl" />}>
        <AccountDetails />
      </Suspense>
    </Container>
  );
}

async function AccountDetails() {
  const user = await requireUserPage("/account");
  const profile = await getProfile();

  return (
    <div className="mt-10 space-y-8">
      <section className="metal flex flex-wrap items-center gap-3 rounded-3xl p-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-fg text-[15px] font-semibold">Signed in</h2>
          <p className="text-muted mt-1 truncate text-sm">{user.email}</p>
        </div>
        <SignOutButton />
      </section>

      <ProfileSection
        uploadEnabled={resumeUploadEnabled}
        resume={
          profile?.resumeFilename && profile.resumeSize
            ? {
                filename: profile.resumeFilename,
                size: profile.resumeSize,
                updatedAt: (profile.resumeUpdatedAt ?? new Date()).toISOString(),
              }
            : null
        }
        profile={{ fullName: profile?.fullName ?? user.name, ...profile }}
      />

      <DeleteAccount />
    </div>
  );
}
