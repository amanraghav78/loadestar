"use client";

import { useActionState, useImperativeHandle, useState, type Ref } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { formatInrShort } from "@/lib/format";
import type { ResumeSuggestions } from "@/lib/resume-parse";
import { cn } from "@/lib/cn";
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
  currentSalary?: number | null;
  expectedSalary?: number | null;
  noticePeriod?: number | null;
  skills?: string[];
};

/** What the page above calls when a resume has just been read. */
export type ProfileFormHandle = { applySuggestions: (values: ResumeSuggestions) => void };

type Field =
  | "fullName"
  | "phone"
  | "city"
  | "currentTitle"
  | "yearsExperience"
  | "linkedinUrl"
  | "githubUrl"
  | "portfolioUrl"
  | "currentSalary"
  | "expectedSalary"
  | "noticePeriod"
  | "skills";

type Values = Record<Field, string>;

/**
 * Pay goes back into the box the way it is quoted — 1800000 as "18 L" — which
 * `parseInrAmount` reads back to the same number on the next save.
 */
const payToInput = (amount?: number | null) => (amount == null ? "" : formatInrShort(amount));

const NOTICE_OPTIONS = [
  ["0", "Immediately"],
  ["15", "15 days"],
  ["30", "1 month"],
  ["45", "45 days"],
  ["60", "2 months"],
  ["90", "3 months"],
] as const;

function initialValues(profile: ProfileValues): Values {
  return {
    fullName: profile.fullName ?? "",
    phone: profile.phone ?? "",
    city: profile.city ?? "",
    currentTitle: profile.currentTitle ?? "",
    yearsExperience: profile.yearsExperience?.toString() ?? "",
    linkedinUrl: profile.linkedinUrl ?? "",
    githubUrl: profile.githubUrl ?? "",
    portfolioUrl: profile.portfolioUrl ?? "",
    currentSalary: payToInput(profile.currentSalary),
    expectedSalary: payToInput(profile.expectedSalary),
    noticePeriod: profile.noticePeriod?.toString() ?? "",
    skills: (profile.skills ?? []).join(", "),
  };
}

export function ProfileForm({ profile, ref }: { profile: ProfileValues; ref?: Ref<ProfileFormHandle> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  const [values, setValues] = useState<Values>(() => initialValues(profile));
  /** Fields this resume filled, so the candidate can see what to check. */
  const [filled, setFilled] = useState<Set<Field>>(new Set());
  const [filledCount, setFilledCount] = useState(0);

  const set = (field: Field) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { value } = event.target;
    setValues((previous) => ({ ...previous, [field]: value }));
    // Once they edit a field themselves it is theirs, not a suggestion.
    setFilled((previous) => {
      if (!previous.has(field)) return previous;
      const next = new Set(previous);
      next.delete(field);
      return next;
    });
  };

  /**
   * Called straight from the upload handler above, never from an effect: this
   * is a response to something the candidate did, not state to synchronise.
   */
  useImperativeHandle(ref, () => ({
    applySuggestions(s: ResumeSuggestions) {
      const next = { ...values };
      const touched = new Set<Field>();

      // Only ever fills a blank. Something the candidate typed is never
      // overwritten by a guess made from a PDF.
      const fill = (field: Field, value: string | undefined) => {
        if (!value || next[field].trim() !== "") return;
        next[field] = value;
        touched.add(field);
      };

      fill("fullName", s.fullName);
      fill("phone", s.phone);
      fill("city", s.city);
      fill("currentTitle", s.currentTitle);
      fill("yearsExperience", s.yearsExperience?.toString());
      fill("linkedinUrl", s.linkedinUrl);
      fill("githubUrl", s.githubUrl);
      fill("portfolioUrl", s.portfolioUrl);
      fill("currentSalary", payToInput(s.currentSalary));
      fill("expectedSalary", payToInput(s.expectedSalary));
      fill("noticePeriod", s.noticePeriod?.toString());

      // Skills are additive: the resume finds ones they forgot without
      // dropping any they added by hand.
      if (s.skills.length > 0) {
        const existing = next.skills.split(",").map((t) => t.trim()).filter(Boolean);
        const seen = new Set(existing.map((t) => t.toLowerCase()));
        const added = s.skills.filter((skill) => !seen.has(skill.toLowerCase()));
        if (added.length > 0) {
          next.skills = [...existing, ...added].slice(0, 40).join(", ");
          touched.add("skills");
        }
      }

      setValues(next);
      setFilled(touched);
      setFilledCount(touched.size);
    },
  }));

  const err = (field: string) => state.errors?.[field]?.[0];

  /**
   * "From your resume" is a description, not part of the label: it says where a
   * value came from, and folding it into the accessible name would rename the
   * field every time a resume filled it.
   */
  const field = (name: Field, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <Label htmlFor={name}>{label}</Label>
      {input}
      {err(name) ? (
        <p className="mt-1 text-xs text-danger">{err(name)}</p>
      ) : filled.has(name) ? (
        <p id={`${name}-source`} className="mt-1 text-xs text-accent-fg">
          From your resume
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-subtle">{hint}</p>
      )}
    </div>
  );

  const text = (name: Field, props: React.ComponentProps<typeof Input> = {}) => (
    <Input
      id={name}
      name={name}
      value={values[name]}
      onChange={set(name)}
      aria-describedby={filled.has(name) ? `${name}-source` : undefined}
      className={cn(filled.has(name) && "border-accent-fg/50")}
      {...props}
    />
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      {filledCount > 0 && !state.saved && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-accent-fg/40 px-4 py-2.5 text-sm text-muted">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent-fg" aria-hidden />
          <span>
            We filled {filledCount} {filledCount === 1 ? "field" : "fields"} from your resume. Check them, then save
            &mdash; nothing is stored until you do.
          </span>
        </p>
      )}

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

      {field("fullName", "Full name", text("fullName", { required: true, autoComplete: "name" }))}

      <div className="grid gap-5 sm:grid-cols-2">
        {field("phone", "Phone", text("phone", { type: "tel", autoComplete: "tel" }), "Optional.")}
        {field("city", "City", text("city", { autoComplete: "address-level2" }), "Where you want to work.")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {field("currentTitle", "Current title", text("currentTitle"))}
        {field(
          "yearsExperience",
          "Years of experience",
          text("yearsExperience", { type: "number", min: 0, max: 60 }),
          "Used to match you to the right level.",
        )}
      </div>

      {field(
        "skills",
        "Skills",
        text("skills", { placeholder: "Python, AWS, Kubernetes" }),
        "Comma separated. These are what we match roles against.",
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        {field("currentSalary", "Current salary", text("currentSalary", { placeholder: "18 LPA" }), "Per year. Private.")}
        {field("expectedSalary", "Expected salary", text("expectedSalary", { placeholder: "25 LPA" }), "Per year.")}
        {field(
          "noticePeriod",
          "Notice period",
          <Select id="noticePeriod" name="noticePeriod" value={values.noticePeriod} onChange={set("noticePeriod")}>
            <option value="">Not saying</option>
            {NOTICE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>,
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {field("linkedinUrl", "LinkedIn", text("linkedinUrl", { type: "url" }))}
        {field("githubUrl", "GitHub", text("githubUrl", { type: "url" }))}
      </div>

      {field("portfolioUrl", "Portfolio or website", text("portfolioUrl", { type: "url" }))}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
