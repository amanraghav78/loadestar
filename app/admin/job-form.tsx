"use client";

import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DISCIPLINE_LABEL, EMPLOYMENT_TYPE_LABEL, LEVEL_LABEL, REMOTE_LABEL } from "@/lib/format";
import { saveJob, type FormState } from "./actions";

export type JobFormValues = {
  id?: string;
  title?: string;
  companyId?: string;
  description?: string;
  discipline?: string;
  employmentType?: string;
  level?: string;
  tags?: string[];
  location?: string;
  remote?: string;
  remoteRegion?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
  applyUrl?: string;
  featured?: boolean;
};

export function JobForm({ job = {}, companies }: { job?: JobFormValues; companies: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveJob, {});
  const err = (field: string) => state.errors?.[field]?.[0];

  return (
    <form action={action} className="max-w-3xl space-y-5" noValidate>
      {job.id && <input type="hidden" name="id" value={job.id} />}

      {state.message && (
        <p role="alert" className="border-danger/40 text-danger rounded-lg border px-4 py-2 text-sm">
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
        <Field label="Job type" name="employmentType" error={err("employmentType")}>
          <Select id="employmentType" name="employmentType" defaultValue={job.employmentType ?? "FULL_TIME"}>
            {Object.entries(EMPLOYMENT_TYPE_LABEL).map(([v, l]) => (
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
        <Field
          label="Salary min (annual, optional)"
          name="salaryMin"
          error={err("salaryMin")}
          hint="In rupees, e.g. 2500000 for ₹25 LPA"
        >
          <Input
            id="salaryMin"
            name="salaryMin"
            type="number"
            min={1}
            step={10000}
            defaultValue={job.salaryMin ?? ""}
          />
        </Field>
        <Field
          label="Salary max (annual, optional)"
          name="salaryMax"
          error={err("salaryMax")}
          hint="Leave both empty if not disclosed"
        >
          <Input
            id="salaryMax"
            name="salaryMax"
            type="number"
            min={1}
            step={10000}
            defaultValue={job.salaryMax ?? ""}
          />
        </Field>
        <Field label="Currency" name="currency" error={err("currency")}>
          <Select id="currency" name="currency" defaultValue={job.currency ?? "INR"}>
            <option value="INR">INR</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Experience from (years, optional)"
          name="experienceMin"
          error={err("experienceMin")}
          hint="0 for freshers"
        >
          <Input
            id="experienceMin"
            name="experienceMin"
            type="number"
            min={0}
            max={40}
            step={1}
            defaultValue={job.experienceMin ?? ""}
          />
        </Field>
        <Field
          label="Experience to (years, optional)"
          name="experienceMax"
          error={err("experienceMax")}
          hint="Empty for “3+ years”"
        >
          <Input
            id="experienceMax"
            name="experienceMax"
            type="number"
            min={0}
            max={40}
            step={1}
            defaultValue={job.experienceMax ?? ""}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Location" name="location" error={err("location")} hint="Indian city, e.g. Bengaluru">
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
          <Input id="remoteRegion" name="remoteRegion" defaultValue={job.remoteRegion ?? ""} placeholder="India" />
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

      <label className="text-muted flex items-center gap-2 text-sm">
        <input type="checkbox" name="featured" defaultChecked={job.featured} className="accent-accent size-4" />
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
        <p className="text-danger mt-1 text-xs">{error}</p>
      ) : (
        hint && <p className="text-subtle mt-1 text-xs">{hint}</p>
      )}
    </div>
  );
}
