"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { INDUSTRY_LABEL } from "@/lib/format";
import { TOKEN_HINT } from "@/lib/ingest/tokens";
import { saveCompany, type FormState } from "./actions";

export type CompanyFormValues = {
  id?: string;
  name?: string;
  website?: string;
  logoUrl?: string | null;
  description?: string | null;
  hq?: string | null;
  size?: string | null;
  industry?: string | null;
  atsSource?: string | null;
  atsToken?: string | null;
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
        <p className="text-danger mt-1 text-xs">{err(name)}</p>
      ) : (
        hint && <p className="text-subtle mt-1 text-xs">{hint}</p>
      )}
    </div>
  );

  return (
    <form action={action} className="max-w-2xl space-y-5" noValidate>
      {company.id && <input type="hidden" name="id" value={company.id} />}
      {state.message && (
        <p role="alert" className="border-danger/40 text-danger rounded-lg border px-4 py-2 text-sm">
          {state.message}
        </p>
      )}
      {field("name", "Name", <Input id="name" name="name" defaultValue={company.name} required />)}
      <div className="grid gap-5 sm:grid-cols-2">
        {field(
          "website",
          "Website",
          <Input id="website" name="website" type="url" defaultValue={company.website} required />,
        )}
        {field(
          "logoUrl",
          "Logo URL",
          <Input id="logoUrl" name="logoUrl" type="url" defaultValue={company.logoUrl ?? ""} />,
          "Optional, square image. Falls back to a letter tile.",
        )}
      </div>
      {field(
        "industry",
        "Industry",
        <Select id="industry" name="industry" defaultValue={company.industry ?? ""}>
          <option value="">Not classified</option>
          {Object.entries(INDUSTRY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>,
        "Drives the industry filter on /jobs.",
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {field(
          "atsSource",
          "Job-board feed",
          <select
            id="atsSource"
            name="atsSource"
            defaultValue={company.atsSource ?? ""}
            className="border-line bg-surface text-fg h-10 w-full rounded-lg border px-3 text-sm"
          >
            <option value="">None (add roles by hand)</option>
            {Object.entries(TOKEN_HINT).map(([value, hint]) => (
              <option key={value} value={value}>
                {hint.label}
              </option>
            ))}
          </select>,
          "Roles are synced daily from this public careers-site API.",
        )}
        {field(
          "atsToken",
          "Board token",
          <Input id="atsToken" name="atsToken" defaultValue={company.atsToken ?? ""} placeholder="stripe" />,
          `e.g. ${Object.values(TOKEN_HINT)
            .filter((h) => h.label === "Greenhouse" || h.label === "Workday")
            .map((h) => h.example)
            .join("  or  ")}. Separate several career sites with spaces.`,
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {field("hq", "Headquarters", <Input id="hq" name="hq" defaultValue={company.hq ?? ""} />)}
        {field(
          "size",
          "Team size",
          <Input id="size" name="size" defaultValue={company.size ?? ""} placeholder="51–200" />,
        )}
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
        <Textarea id="description" name="description" rows={5} defaultValue={company.description ?? ""} />,
      )}
      <label className="text-muted flex items-center gap-2 text-sm">
        <input type="checkbox" name="featured" defaultChecked={company.featured} className="accent-accent size-4" />
        Show in &ldquo;Hiring on Lodestar&rdquo; on the home page
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : company.id ? "Save changes" : "Create company"}
      </Button>
    </form>
  );
}
