"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { saveProfile, type FormState } from "./actions";

export type ProfileValues = {
  fullName?: string;
  phone?: string | null;
  city?: string | null;
  yearsExperience?: number | null;
  currentTitle?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
};

export function ProfileForm({ profile }: { profile: ProfileValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  const err = (f: string) => state.errors?.[f]?.[0];

  const field = (name: keyof ProfileValues, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <Label htmlFor={name}>{label}</Label>
      {input}
      {err(name) ? (
        <p className="mt-1 text-xs text-danger">{err(name)}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-subtle">{hint}</p>
      )}
    </div>
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && (
        <p
          role={state.saved ? "status" : "alert"}
          className={`rounded-lg border px-4 py-2 text-sm ${
            state.saved ? "border-line text-muted" : "border-danger/40 text-danger"
          }`}
        >
          {state.message}
        </p>
      )}

      {field(
        "fullName",
        "Full name",
        <Input id="fullName" name="fullName" defaultValue={profile.fullName ?? ""} required autoComplete="name" />,
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {field(
          "phone",
          "Phone",
          <Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" />,
          "Optional.",
        )}
        {field(
          "city",
          "City",
          <Input id="city" name="city" defaultValue={profile.city ?? ""} autoComplete="address-level2" />,
          "Where you want to work.",
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {field(
          "currentTitle",
          "Current title",
          <Input id="currentTitle" name="currentTitle" defaultValue={profile.currentTitle ?? ""} />,
        )}
        {field(
          "yearsExperience",
          "Years of experience",
          <Input
            id="yearsExperience"
            name="yearsExperience"
            type="number"
            min={0}
            max={60}
            defaultValue={profile.yearsExperience ?? ""}
          />,
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {field(
          "linkedinUrl",
          "LinkedIn",
          <Input id="linkedinUrl" name="linkedinUrl" type="url" defaultValue={profile.linkedinUrl ?? ""} />,
        )}
        {field(
          "githubUrl",
          "GitHub",
          <Input id="githubUrl" name="githubUrl" type="url" defaultValue={profile.githubUrl ?? ""} />,
        )}
      </div>

      {field(
        "portfolioUrl",
        "Portfolio or website",
        <Input id="portfolioUrl" name="portfolioUrl" type="url" defaultValue={profile.portfolioUrl ?? ""} />,
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
