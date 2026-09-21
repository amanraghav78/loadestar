"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { saveCompany, type FormState } from "./actions";

export type CompanyFormValues = {
  id?: string;
  name?: string;
  website?: string;
  logoUrl?: string | null;
  description?: string;
  hq?: string;
  size?: string;
  medianResponseDays?: number | null;
  featured?: boolean;
};

export function CompanyForm({ company = {} }: { company?: CompanyFormValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCompany, {});
  const err = (f: string) => state.errors?.[f]?.[0];

  const field = (name: keyof CompanyFormValues, label: string, input: React.ReactNode, hint?: string) => (
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
    <form action={action} className="max-w-2xl space-y-5" noValidate>
      {company.id && <input type="hidden" name="id" value={company.id} />}
      {state.message && (
        <p role="alert" className="rounded-lg border border-danger/40 px-4 py-2 text-sm text-danger">
          {state.message}
        </p>
      )}
      {field("name", "Name", <Input id="name" name="name" defaultValue={company.name} required />)}
      <div className="grid gap-5 sm:grid-cols-2">
        {field("website", "Website", <Input id="website" name="website" type="url" defaultValue={company.website} required />)}
        {field(
          "logoUrl",
          "Logo URL",
          <Input id="logoUrl" name="logoUrl" type="url" defaultValue={company.logoUrl ?? ""} />,
          "Optional, square image. Falls back to a letter tile.",
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {field("hq", "Headquarters", <Input id="hq" name="hq" defaultValue={company.hq} required />)}
        {field("size", "Team size", <Input id="size" name="size" defaultValue={company.size} placeholder="51–200" required />)}
        {field(
          "medianResponseDays",
          "Median reply (days)",
          <Input
            id="medianResponseDays"
            name="medianResponseDays"
            type="number"
            min={0}
            max={120}
            defaultValue={company.medianResponseDays ?? ""}
          />,
        )}
      </div>
      {field(
        "description",
        "Description",
        <Textarea id="description" name="description" rows={5} defaultValue={company.description} required />,
      )}
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="featured" defaultChecked={company.featured} className="size-4 accent-[#7c6cf0]" />
        Show in &ldquo;Hiring on Lodestar&rdquo; on the home page
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : company.id ? "Save changes" : "Create company"}
      </Button>
    </form>
  );
}
