"use client";

import { useActionState, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Plus, Trash2 } from "lucide-react";
import { reviewResume } from "@/lib/ats-check";
import {
  layoutResume,
  newCertification,
  newEducation,
  newExperience,
  newProject,
  type ResumeCertification,
  type ResumeContact,
  type ResumeContent,
  type ResumeEducation,
  type ResumeExperience,
  type ResumeProject,
} from "@/lib/resume-builder";
import { buildResumePdf, resumeFileName } from "@/lib/resume-pdf";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { AtsReportPanel } from "./ats-report";
import { ResumePreview } from "./resume-preview";
import { saveResume } from "./actions";
import type { FormState } from "../actions";

/**
 * The resume builder.
 *
 * The document lives in React state and is posted as one JSON field, because
 * its sections are lists the candidate adds to and reorders rather than a fixed
 * form. Everything shown alongside it — the preview and the ATS review — is
 * computed from that same state by the pure modules in lib/, which is what
 * makes the review honest: it is reading the document that will be rendered,
 * not a description of it.
 *
 * Contact details are not edited here. They come from the profile, so a phone
 * number is right everywhere or wrong everywhere.
 */

type Props = {
  initial: ResumeContent;
  contact: ResumeContact;
  /** Null until they save for the first time. */
  savedAt: string | null;
  /** Whether a resume can be kept on file at all (see lib/storage). */
  storageEnabled: boolean;
};

const move = <T,>(list: T[], index: number, delta: number) => {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

const replace = <T,>(list: T[], index: number, value: T) => list.map((item, i) => (i === index ? value : item));

/** Fixed to UTC so the server and the browser render the same string. */
const savedDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const toSkills = (text: string) =>
  text
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

export function ResumeBuilder({ initial, contact, savedAt, storageEnabled }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveResume, {});
  const [content, setContent] = useState<ResumeContent>(initial);
  /**
   * Skills are typed as one comma-separated line, so the text has to be the
   * state: deriving it from the array would fight the cursor on every comma.
   */
  const [skillsText, setSkillsText] = useState(initial.skills.join(", "));
  const [fileState, setFileState] = useState<{ busy: boolean; message: string | null; error: boolean }>({
    busy: false,
    message: null,
    error: false,
  });

  const blocks = useMemo(() => layoutResume(content, contact), [content, contact]);
  const report = useMemo(() => reviewResume(content, contact), [content, contact]);

  const patch = (values: Partial<ResumeContent>) => setContent((current) => ({ ...current, ...values }));

  function download() {
    const blob = new Blob([buildResumePdf(content, contact)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = resumeFileName(contact.fullName);
    // In the document and revoked a tick later: Firefox cancels a download
    // whose blob URL disappears in the same turn, and ignores a detached link.
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /** Renders the *saved* document server-side and keeps it as their resume on file. */
  async function keepOnFile() {
    setFileState({ busy: true, message: null, error: false });
    const res = await fetch("/api/resume/pdf", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { error?: string; filename?: string };
    setFileState({
      busy: false,
      error: !res.ok,
      message: res.ok
        ? `Saved as ${body.filename}. It is now the resume on your account.`
        : (body.error ?? "That didn't work. Please try again."),
    });
  }

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form action={action} className="min-w-0 space-y-6">
        <input type="hidden" name="content" value={JSON.stringify(content)} />

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

        <Card title="The basics" hint="Printed under your name, before anything else.">
          <div>
            <Label htmlFor="headline">Role you want</Label>
            <Input
              id="headline"
              maxLength={120}
              value={content.headline}
              onChange={(e) => patch({ headline: e.target.value })}
              placeholder="Senior Backend Engineer"
            />
            <p className="text-subtle mt-1 text-xs">Title it the way a posting would.</p>
          </div>

          <div>
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              maxLength={1500}
              value={content.summary}
              onChange={(e) => patch({ summary: e.target.value })}
              className="min-h-24"
              placeholder="Backend engineer with six years on payments systems in Python and Go…"
            />
            <p className="text-subtle mt-1 text-xs">Two or three lines. What you do, for how long, and what next.</p>
          </div>

          <div>
            <Label htmlFor="skills">Skills</Label>
            <Input
              id="skills"
              value={skillsText}
              onChange={(e) => {
                setSkillsText(e.target.value);
                patch({ skills: toSkills(e.target.value) });
              }}
              placeholder="Python, Django, PostgreSQL, AWS, Docker"
            />
            <p className="text-subtle mt-1 text-xs">
              Comma separated, spelled the way postings spell them. Six to fifteen is the right number.
            </p>
          </div>
        </Card>

        <Card
          title="Experience"
          hint="Newest first. This is the section an ATS reads hardest."
          onAdd={() => patch({ experience: [...content.experience, newExperience()] })}
          addLabel="Add a role"
        >
          {content.experience.length === 0 && <Empty>No roles yet.</Empty>}
          {content.experience.map((entry, index) => (
            <Entry
              key={index}
              label={entry.role || entry.company || `Role ${index + 1}`}
              index={index}
              count={content.experience.length}
              onMove={(delta) => patch({ experience: move(content.experience, index, delta) })}
              onRemove={() => patch({ experience: content.experience.filter((_, i) => i !== index) })}
            >
              <ExperienceFields
                entry={entry}
                index={index}
                onChange={(next) => patch({ experience: replace(content.experience, index, next) })}
              />
            </Entry>
          ))}
        </Card>

        <Card
          title="Projects"
          hint="Optional. Worth having when your experience is short."
          onAdd={() => patch({ projects: [...content.projects, newProject()] })}
          addLabel="Add a project"
        >
          {content.projects.map((entry, index) => (
            <Entry
              key={index}
              label={entry.name || `Project ${index + 1}`}
              index={index}
              count={content.projects.length}
              onMove={(delta) => patch({ projects: move(content.projects, index, delta) })}
              onRemove={() => patch({ projects: content.projects.filter((_, i) => i !== index) })}
            >
              <ProjectFields
                entry={entry}
                index={index}
                onChange={(next) => patch({ projects: replace(content.projects, index, next) })}
              />
            </Entry>
          ))}
        </Card>

        <Card
          title="Education"
          hint="Degree, institution and year — a filter on most Indian applications."
          onAdd={() => patch({ education: [...content.education, newEducation()] })}
          addLabel="Add a qualification"
        >
          {content.education.map((entry, index) => (
            <Entry
              key={index}
              label={entry.degree || entry.institution || `Qualification ${index + 1}`}
              index={index}
              count={content.education.length}
              onMove={(delta) => patch({ education: move(content.education, index, delta) })}
              onRemove={() => patch({ education: content.education.filter((_, i) => i !== index) })}
            >
              <EducationFields
                entry={entry}
                index={index}
                onChange={(next) => patch({ education: replace(content.education, index, next) })}
              />
            </Entry>
          ))}
        </Card>

        <Card
          title="Certifications"
          hint="Optional."
          onAdd={() => patch({ certifications: [...content.certifications, newCertification()] })}
          addLabel="Add a certification"
        >
          {content.certifications.map((entry, index) => (
            <Entry
              key={index}
              label={entry.name || `Certification ${index + 1}`}
              index={index}
              count={content.certifications.length}
              onMove={(delta) => patch({ certifications: move(content.certifications, index, delta) })}
              onRemove={() => patch({ certifications: content.certifications.filter((_, i) => i !== index) })}
            >
              <CertificationFields
                entry={entry}
                index={index}
                onChange={(next) => patch({ certifications: replace(content.certifications, index, next) })}
              />
            </Entry>
          ))}
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save resume"}
          </Button>
          <button type="button" onClick={download} className={buttonClass("secondary", "md", "gap-2")}>
            <Download className="size-4" aria-hidden />
            Download PDF
          </button>
          {storageEnabled && (savedAt || state.saved) && (
            <button type="button" onClick={keepOnFile} disabled={fileState.busy} className={buttonClass("ghost", "md")}>
              {fileState.busy ? "Saving…" : "Keep as my resume on file"}
            </button>
          )}
        </div>

        <p className="text-subtle text-xs">
          The download is built in your browser from what is on screen, so it always matches the preview.{" "}
          {savedAt ? `Last saved ${savedDate.format(new Date(savedAt))}.` : "Nothing is stored until you save."}
        </p>

        {fileState.message && (
          <p
            role={fileState.error ? "alert" : "status"}
            className={`text-sm ${fileState.error ? "text-danger" : "text-muted"}`}
          >
            {fileState.message}
          </p>
        )}
      </form>

      <div className="min-w-0 space-y-6 lg:sticky lg:top-6 lg:self-start">
        <AtsReportPanel report={report} />
        <div>
          <h2 className="text-fg mb-3 text-[15px] font-semibold">Preview</h2>
          <ResumePreview blocks={blocks} />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ chrome

function Card({
  title,
  hint,
  children,
  onAdd,
  addLabel,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <section className="metal rounded-3xl p-6">
      <h2 className="text-fg text-[15px] font-semibold">{title}</h2>
      <p className="text-muted mt-1 mb-5 text-sm">{hint}</p>
      <div className="space-y-5">{children}</div>
      {onAdd && (
        <button type="button" onClick={onAdd} className={buttonClass("secondary", "sm", "mt-5 gap-1.5")}>
          <Plus className="size-3.5" aria-hidden />
          {addLabel}
        </button>
      )}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-subtle text-sm">{children}</p>;

function Entry({
  label,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const icon = "rounded-full p-1.5 text-muted hover:bg-card hover:text-fg disabled:opacity-30";
  return (
    <div className="border-line rounded-2xl border p-5">
      <div className="mb-4 flex items-center gap-1">
        <p className="text-muted min-w-0 flex-1 truncate text-xs font-medium">{label}</p>
        <button
          type="button"
          className={icon}
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`Move ${label} up`}
        >
          <ArrowUp className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className={icon}
          onClick={() => onMove(1)}
          disabled={index === count - 1}
          aria-label={`Move ${label} down`}
        >
          <ArrowDown className="size-3.5" aria-hidden />
        </button>
        <button type="button" className={icon} onClick={onRemove} aria-label={`Remove ${label}`}>
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** Labels have to stay unique per entry, or a click on one lands in another. */
function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-subtle mt-1 text-xs">{hint}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ sections

/** One bullet per line: the shape they are written in, and the shape they print in. */
function Bullets({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string[];
  onChange: (bullets: string[]) => void;
  placeholder: string;
}) {
  return (
    <Field
      id={id}
      label="What you did"
      hint="One bullet per line. Start with a verb, and put a number in where you can."
    >
      <Textarea
        id={id}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        className="min-h-28"
        placeholder={placeholder}
      />
    </Field>
  );
}

function ExperienceFields({
  entry,
  index,
  onChange,
}: {
  entry: ResumeExperience;
  index: number;
  onChange: (entry: ResumeExperience) => void;
}) {
  const id = (name: string) => `experience-${index}-${name}`;
  const set = (values: Partial<ResumeExperience>) => onChange({ ...entry, ...values });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("role")} label="Title">
          <Input
            id={id("role")}
            maxLength={100}
            value={entry.role}
            onChange={(e) => set({ role: e.target.value })}
            placeholder="Backend Engineer"
          />
        </Field>
        <Field id={id("company")} label="Employer">
          <Input
            id={id("company")}
            maxLength={100}
            value={entry.company}
            onChange={(e) => set({ company: e.target.value })}
            placeholder="Razorpay"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={id("location")} label="Location">
          <Input
            id={id("location")}
            maxLength={60}
            value={entry.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Bengaluru"
          />
        </Field>
        <Field id={id("start")} label="From">
          <Input id={id("start")} type="month" value={entry.start} onChange={(e) => set({ start: e.target.value })} />
        </Field>
        <Field id={id("end")} label="To">
          <Input
            id={id("end")}
            type="month"
            value={entry.end}
            disabled={entry.current}
            onChange={(e) => set({ end: e.target.value })}
          />
        </Field>
      </div>

      <label className="text-muted flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={entry.current}
          onChange={(e) => set({ current: e.target.checked, end: e.target.checked ? "" : entry.end })}
          className="border-line bg-surface size-4 rounded"
        />
        I still work here
      </label>

      <Bullets
        id={id("bullets")}
        value={entry.bullets}
        onChange={(bullets) => set({ bullets })}
        placeholder={
          "Cut checkout latency 40% by rewriting the settlement job in Go\nLed a team of four through the UPI migration"
        }
      />
    </>
  );
}

function ProjectFields({
  entry,
  index,
  onChange,
}: {
  entry: ResumeProject;
  index: number;
  onChange: (entry: ResumeProject) => void;
}) {
  const id = (name: string) => `project-${index}-${name}`;
  const set = (values: Partial<ResumeProject>) => onChange({ ...entry, ...values });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("name")} label="Name">
          <Input id={id("name")} maxLength={120} value={entry.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id={id("link")} label="Link" hint="Optional.">
          <Input
            id={id("link")}
            maxLength={300}
            value={entry.link}
            onChange={(e) => set({ link: e.target.value })}
            placeholder="github.com/you/project"
          />
        </Field>
      </div>
      <Bullets
        id={id("bullets")}
        value={entry.bullets}
        onChange={(bullets) => set({ bullets })}
        placeholder="Built a 2,000-user scheduling app in Next.js and Postgres"
      />
    </>
  );
}

function EducationFields({
  entry,
  index,
  onChange,
}: {
  entry: ResumeEducation;
  index: number;
  onChange: (entry: ResumeEducation) => void;
}) {
  const id = (name: string) => `education-${index}-${name}`;
  const set = (values: Partial<ResumeEducation>) => onChange({ ...entry, ...values });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("degree")} label="Degree">
          <Input
            id={id("degree")}
            maxLength={100}
            value={entry.degree}
            onChange={(e) => set({ degree: e.target.value })}
            placeholder="B.Tech, Computer Science"
          />
        </Field>
        <Field id={id("institution")} label="Institution">
          <Input
            id={id("institution")}
            maxLength={120}
            value={entry.institution}
            onChange={(e) => set({ institution: e.target.value })}
            placeholder="NIT Warangal"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field id={id("location")} label="Location">
          <Input
            id={id("location")}
            maxLength={60}
            value={entry.location}
            onChange={(e) => set({ location: e.target.value })}
          />
        </Field>
        <Field id={id("start")} label="From">
          <Input
            id={id("start")}
            maxLength={24}
            value={entry.start}
            onChange={(e) => set({ start: e.target.value })}
            placeholder="2017"
          />
        </Field>
        <Field id={id("end")} label="To">
          <Input
            id={id("end")}
            maxLength={24}
            value={entry.end}
            onChange={(e) => set({ end: e.target.value })}
            placeholder="2021"
          />
        </Field>
        <Field id={id("detail")} label="Result">
          <Input
            id={id("detail")}
            maxLength={120}
            value={entry.detail}
            onChange={(e) => set({ detail: e.target.value })}
            placeholder="CGPA 8.7"
          />
        </Field>
      </div>
    </>
  );
}

function CertificationFields({
  entry,
  index,
  onChange,
}: {
  entry: ResumeCertification;
  index: number;
  onChange: (entry: ResumeCertification) => void;
}) {
  const id = (name: string) => `certification-${index}-${name}`;
  const set = (values: Partial<ResumeCertification>) => onChange({ ...entry, ...values });

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field id={id("name")} label="Name">
        <Input
          id={id("name")}
          maxLength={120}
          value={entry.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="AWS Solutions Architect"
        />
      </Field>
      <Field id={id("issuer")} label="Issued by">
        <Input
          id={id("issuer")}
          maxLength={100}
          value={entry.issuer}
          onChange={(e) => set({ issuer: e.target.value })}
          placeholder="Amazon Web Services"
        />
      </Field>
      <Field id={id("year")} label="Year">
        <Input
          id={id("year")}
          maxLength={24}
          value={entry.year}
          onChange={(e) => set({ year: e.target.value })}
          placeholder="2024"
        />
      </Field>
    </div>
  );
}
