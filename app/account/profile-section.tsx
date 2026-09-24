"use client";

import { useRef } from "react";
import { ProfileForm, type ProfileFormHandle, type ProfileValues } from "./profile-form";
import { ResumeCard, type Resume } from "./resume-card";

/**
 * Holds the two halves of the account page together: uploading a resume hands
 * what we read out of it straight to the form below, where the candidate can
 * see every value before anything is saved.
 */
export function ProfileSection({
  profile,
  resume,
  uploadEnabled,
}: {
  profile: ProfileValues;
  resume: Resume;
  uploadEnabled: boolean;
}) {
  const form = useRef<ProfileFormHandle>(null);

  return (
    <>
      <ResumeCard
        resume={resume}
        uploadEnabled={uploadEnabled}
        onSuggestions={(values) => form.current?.applySuggestions(values)}
      />

      <section className="metal rounded-3xl p-6" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-[15px] font-semibold text-fg">
          Profile
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          Everything except your name is optional. Your skills and experience are what we match roles against.
        </p>
        <ProfileForm profile={profile} ref={form} />
      </section>
    </>
  );
}
