"use client";

import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DISCIPLINE_LABEL, LEVEL_LABEL, REMOTE_LABEL } from "@/lib/format";
import { saveJob, type FormState } from "./actions";

export type JobFormValues = {
  id?: string;
  title?: string;
  companyId?: string;
  description?: string;
  discipline?: string;
  level?: string;
  tags?: string[];
  location?: string;
  remote?: string;
  remoteRegion?: string | null;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  applyUrl?: string;
  featured?: boolean;
};

export function JobForm({
  job = {},
  companies,
}: {
  job?: JobFormValues;
  companies: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveJob, {});
  const err = (field: string) => state.errors?.[field]?.[0];

  return (
    <form action={action} className="max-w-3xl space-y-5" noValidate>
      {job.id && <input type="hidden" name="id" value={job.id} />}

      {state.message && (
        <p role="alert" className="rounded-lg border border-danger/40 px-4 py-2 text-sm text-danger">
          {state.message}
        </p>
      )}

      <Field label="Title" name="title" error={err("title")}>
        <Input id="title" name="title" defaultValue={job.title} required maxLength={120} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Company" name="companyId" error={err("companyId")}>
          <Select id="companyId" name="companyId" defaultValue={job.companyId ?? ""} required>
            <option value="" disabled>
              Choose…
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Discipline" name="discipline" error={err("discipline")}>
          <Select id="discipline" name="discipline" defaultValue={job.discipline ?? "ENGINEERING"}>
            {Object.entries(DISCIPLINE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Level" name="level" error={err("level")}>
          <Select id="level" name="level" defaultValue={job.level ?? "SENIOR"}>
            {Object.entries(LEVEL_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Salary min (annual)" name="salaryMin" error={err("salaryMin")}>
          <Input id="salaryMin" name="salaryMin" type="number" min={1} step={1000} defaultValue={job.salaryMin} required />
        </Field>
        <Field label="Salary max (annual)" name="salaryMax" error={err("salaryMax")}>
          <Input id="salaryMax" name="salaryMax" type="number" min={1} step={1000} defaultValue={job.salaryMax} required />
        </Field>
        <Field label="Currency" name="currency" error={err("currency")}>
          <Select id="currency" name="currency" defaultValue={job.currency ?? "EUR"}>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Location" name="location" error={err("location")} hint="City, or “Remote”">
          <Input id="location" name="location" defaultValue={job.location} required />
        </Field>
        <Field label="Work setup" name="remote" error={err("remote")}>
          <Select id="remote" name="remote" defaultValue={job.remote ?? "ONSITE"}>
            {Object.entries(REMOTE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Remote region" name="remoteRegion" error={err("remoteRegion")} hint="e.g. Europe, EMEA">
          <Input id="remoteRegion" name="remoteRegion" defaultValue={job.remoteRegion ?? ""} />
        </Field>
      </div>

      <Field
        label="Apply URL"
        name="applyUrl"
        error={err("applyUrl")}
        hint="Company careers page or Google Form. Candidates are redirected here."
      >
        <Input id="applyUrl" name="applyUrl" type="url" defaultValue={job.applyUrl} required placeholder="https://" />
      </Field>

      <Field label="Tags" name="tags" error={err("tags")} hint="Comma separated, up to 8. First three show on cards.">
        <Input id="tags" name="tags" defaultValue={job.tags?.join(", ")} placeholder="Go, Kafka, Distributed systems" />
      </Field>

      <Field
        label="Description"
        name="description"
        error={err("description")}
        hint="Blank line between paragraphs. “## ” starts a heading, “- ” a bullet."
      >
        <Textarea id="description" name="description" rows={16} defaultValue={job.description} required />
      </Field>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="featured" defaultChecked={job.featured} className="size-4 accent-[#7c6cf0]" />
        Feature on the home page
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : job.id ? "Save changes" : "Publish role"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-subtle">{hint}</p>
      )}
    </div>
  );
}
