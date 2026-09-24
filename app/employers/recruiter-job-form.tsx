"use client";

import { useActionState } from "react";
import { CaptchaField } from "@/components/captcha-field";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { DISCIPLINE_LABEL, EMPLOYMENT_TYPE_LABEL, LEVEL_LABEL, REMOTE_LABEL } from "@/lib/format";
import { createRecruiterJob, updateRecruiterJob, type FormState } from "./actions";

export type RecruiterJobValues = {
  id?: string;
  title?: string;
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
  applyUrl?: string;
};

/**
 * The employer's own posting form.
 *
 * Deliberately not the admin form: a recruiter chooses neither the company (it
 * comes from their approved claim) nor whether a role is featured. Salary is
 * required here, because a listing without a band never goes live.
 */
export function RecruiterJobForm({ job = {}, companyName }: { job?: RecruiterJobValues; companyName: string }) {
  const editing = Boolean(job.id);
  const [state, action, pending] = useActionState<FormState, FormData>(
    editing ? updateRecruiterJob : createRecruiterJob,
    {},
  );
  const err = (field: string) => state.errors?.[field]?.[0];

  return (
    <form action={action} className="space-y-5" noValidate>
      {job.id && <input type="hidden" name="id" value={job.id} />}

      {state.message && (
        <p role="alert" className="border-danger/40 text-danger rounded-lg border px-4 py-2.5 text-sm">
          {state.message}
        </p>
      )}

      <p className="text-muted text-sm">
        Posting as <span className="text-fg font-medium">{companyName}</span>.
      </p>

      <Field label="Title" name="title" error={err("title")}>
        <Input id="title" name="title" defaultValue={job.title} required maxLength={120} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
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
          label="Salary from (per year)"
          name="salaryMin"
          error={err("salaryMin")}
          hint="In rupees: 2500000 for ₹25 LPA"
        >
          <Input
            id="salaryMin"
            name="salaryMin"
            type="number"
            min={1}
            step={10000}
            defaultValue={job.salaryMin ?? ""}
            required
          />
        </Field>
        <Field label="Salary to (per year)" name="salaryMax" error={err("salaryMax")} hint="A band we'd hire within">
          <Input
            id="salaryMax"
            name="salaryMax"
            type="number"
            min={1}
            step={10000}
            defaultValue={job.salaryMax ?? ""}
            required
          />
        </Field>
        <Field label="Currency" name="currency" error={err("currency")}>
          <Select id="currency" name="currency" defaultValue={job.currency ?? "INR"}>
            <option value="INR">INR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Location" name="location" error={err("location")} hint="City, e.g. Bengaluru">
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
        <Field label="Remote region" name="remoteRegion" error={err("remoteRegion")} hint="Only for remote roles">
          <Input id="remoteRegion" name="remoteRegion" defaultValue={job.remoteRegion ?? ""} placeholder="India" />
        </Field>
      </div>

      <Field
        label="Where candidates apply"
        name="applyUrl"
        error={err("applyUrl")}
        hint="Your careers page or a form you control. We never take applications for you."
      >
        <Input id="applyUrl" name="applyUrl" type="url" defaultValue={job.applyUrl} required placeholder="https://" />
      </Field>

      <Field
        label="Skills"
        name="tags"
        error={err("tags")}
        hint="Comma separated, up to 8. The first three show on cards."
      >
        <Input id="tags" name="tags" defaultValue={job.tags?.join(", ")} placeholder="Go, Kafka, Postgres" />
      </Field>

      <Field
        label="About the role"
        name="description"
        error={err("description")}
        hint="Blank line between paragraphs. “## ” starts a heading, “- ” a bullet."
      >
        <Textarea id="description" name="description" rows={16} defaultValue={job.description} required />
      </Field>

      <CaptchaField />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : editing ? "Save and resubmit" : "Submit for review"}
        </Button>
        <p className="text-subtle text-xs">
          {editing
            ? "An edit goes back to us for review before it is live again."
            : "We check every listing before it appears, usually within a working day."}
        </p>
      </div>
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
