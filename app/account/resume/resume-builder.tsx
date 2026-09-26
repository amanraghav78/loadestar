"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, CloudOff, Download, Loader2, Plus, Trash2 } from "lucide-react";
import { reviewResume } from "@/lib/ats-check";
import {
  formatPhone,
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
import { isBlankResume, mergeResume, mergeSkills } from "@/lib/resume-prefill";
import {
  bulletListHints,
  educationHints,
  experienceHints,
  headlineHint,
  type Hint,
  skillsHint,
  summaryHint,
} from "@/lib/resume-suggestions";
import { keywordGap, type JobForTailoring } from "@/lib/resume-tailor";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { AtsReportPanel } from "./ats-report";
import { describedBy, HintText, LineHints } from "./hints";
import { ResumePreview } from "./resume-preview";
import { ResumeStart } from "./resume-start";
import { TailorPanel } from "./tailor-panel";
import { saveResumeContent } from "./actions";

/**
 * The resume builder.
 *
 * The document lives in React state and is saved as one value, because its
 * sections are lists the candidate adds to and reorders rather than a fixed
 * form. It saves itself a moment after each change, so nothing is lost to a
 * closed tab. Everything shown alongside it — the preview, the ATS review, the
 * suggestions under each field and the keyword gap against a job — is computed
 * from that same state by the pure modules in lib/, which is what makes them
 * honest: they read the document that will be rendered, not a description of it.
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
  /** The PDF on their profile, which the first-run card offers to start from. */
  uploadedFilename: string | null;
  /** The job they came to tailor for (`?job=`), if any. */
  job: JobForTailoring | null;
};

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

/** How long typing has to pause before it is saved. */
const AUTOSAVE_MS = 1000;

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

const savedTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

const toSkills = (text: string) =>
  text
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

const SECTIONS = [
  { id: "section-basics", label: "Basics" },
  { id: "section-experience", label: "Experience" },
  { id: "section-projects", label: "Projects" },
  { id: "section-education", label: "Education" },
  { id: "section-certifications", label: "Certifications" },
  { id: "section-preview", label: "Preview" },
];

/** Scrolls a field into view and puts the cursor in it; motion only when the reader allows it. */
function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  el.focus({ preventScroll: true });
}

export function ResumeBuilder({ initial, contact, savedAt, storageEnabled, uploadedFilename, job }: Props) {
  const [content, setContent] = useState<ResumeContent>(initial);
  /**
   * Skills are typed as one comma-separated line, so the text has to be the
   * state: deriving it from the array would fight the cursor on every comma.
   */
  const [skillsText, setSkillsText] = useState(initial.skills.join(", "));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(savedAt);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [startDismissed, setStartDismissed] = useState(false);
  const [fileState, setFileState] = useState<{ busy: boolean; message: string | null; error: boolean }>({
    busy: false,
    message: null,
    error: false,
  });

  /** The newest document, for saves that outlive the render that asked for them. */
  const latest = useRef(content);
  /** Bumped on every edit, so a save that finishes after a newer edit doesn't claim to be current. */
  const edits = useRef(0);
  /** Whether the newest edit has yet to reach the server. */
  const dirty = useRef(false);
  /** Saves run one at a time, in order, so an older one can never land last. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const blocks = useMemo(() => layoutResume(content, contact), [content, contact]);
  const report = useMemo(() => reviewResume(content, contact), [content, contact]);
  const gap = useMemo(() => (job ? keywordGap(content, job) : null), [content, job]);

  function update(next: ResumeContent) {
    latest.current = next;
    edits.current += 1;
    dirty.current = true;
    setContent(next);
    setStatus("unsaved");
  }

  const patch = (values: Partial<ResumeContent>) => update({ ...content, ...values });

  const save = useCallback((): Promise<boolean> => {
    const run = async () => {
      const at = edits.current;
      setStatus("saving");
      try {
        const result = await saveResumeContent(latest.current);
        if (!result.ok) {
          setSaveError(result.message);
          setStatus("error");
          return false;
        }
        setSaveError(null);
        setLastSaved(result.savedAt);
        // Typed into while it saved: still unsaved, and the timer saves again.
        if (edits.current === at) dirty.current = false;
        setStatus(edits.current === at ? "saved" : "unsaved");
        return true;
      } catch {
        setSaveError("Couldn't save — check your connection. We'll try again when you next type.");
        setStatus("error");
        return false;
      }
    };
    const next = queue.current.then(run);
    queue.current = next;
    return next;
  }, []);

  // Autosave: a pause in typing saves. `content` restarts the wait on each edit.
  useEffect(() => {
    if (status !== "unsaved") return;
    const timer = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [content, status, save]);

  // Leaving with an edit not yet saved: the browser asks first.
  useEffect(() => {
    if (status !== "unsaved" && status !== "saving" && status !== "error") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  // Leaving by an in-app link doesn't fire beforeunload, so the last edit is
  // sent on the way out instead.
  useEffect(() => {
    const pending = dirty;
    const newest = latest;
    return () => {
      if (pending.current) void saveResumeContent(newest.current).catch(() => {});
    };
  }, []);

  function setSkills(skills: string[]) {
    setSkillsText(skills.join(", "));
    patch({ skills });
  }

  function importResume(imported: ResumeContent) {
    const { content: merged, filled } = mergeResume(content, imported);
    if (filled.length === 0) {
      setNotice("We read your resume, but everything it has is already here.");
      return;
    }
    update(merged);
    setSkillsText(merged.skills.join(", "));
    setStartDismissed(true);
    setNotice(`Filled in ${listOf(filled)} from your resume. Check each section — we read it, we didn't write it.`);
  }

  function addSkill(skill: string) {
    setSkills(mergeSkills(content.skills, [skill]));
    setNotice(`Added ${skill} to your skills.`);
  }

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
    // What is on screen is what gets kept: save it first if it isn't yet.
    if (status !== "saved" && status !== "idle" && !(await save())) {
      setFileState({ busy: false, error: true, message: "Save the resume first, then try again." });
      return;
    }
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

  const showStart = !startDismissed && isBlankResume(content);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form
        className="min-w-0 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        <nav aria-label="Resume sections" className="-mx-1 overflow-x-auto pb-1">
          <ul className="flex gap-1.5 px-1">
            {SECTIONS.map((section) => (
              <li key={section.id} className={section.id === "section-preview" ? "lg:hidden" : undefined}>
                <a href={`#${section.id}`} className="chip">
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {notice && (
          <p role="status" className="border-line text-muted rounded-lg border px-4 py-2 text-sm">
            {notice}
          </p>
        )}

        {showStart && (
          <ResumeStart
            uploadedFilename={storageEnabled ? uploadedFilename : null}
            onImport={importResume}
            onDismiss={() => setStartDismissed(true)}
          />
        )}

        <ContactCard contact={contact} />

        <Card id="section-basics" title="The basics" hint="Printed under your name, before anything else.">
          <div>
            <Label htmlFor="headline">Role you want</Label>
            <Input
              id="headline"
              maxLength={120}
              value={content.headline}
              onChange={(e) => patch({ headline: e.target.value })}
              placeholder="Senior Backend Engineer"
              aria-describedby={describedBy("headline-tip", headlineHint(content.headline) && "headline-hint")}
            />
            <p id="headline-tip" className="text-subtle mt-1 text-xs">
              Title it the way a posting would.
            </p>
            <HintText id="headline-hint" hint={headlineHint(content.headline)} />
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
              aria-describedby={describedBy("summary-tip", summaryHint(content.summary) && "summary-hint")}
            />
            <p id="summary-tip" className="text-subtle mt-1 text-xs">
              Two or three lines. What you do, for how long, and what next.
            </p>
            <HintText id="summary-hint" hint={summaryHint(content.summary)} />
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
              aria-describedby={describedBy("skills-tip", skillsHint(content.skills) && "skills-hint")}
            />
            <p id="skills-tip" className="text-subtle mt-1 text-xs">
              Comma separated, spelled the way postings spell them. Six to fifteen is the right number.
            </p>
            <HintText id="skills-hint" hint={skillsHint(content.skills)} />
          </div>
        </Card>

        <Card
          id="section-experience"
          title="Experience"
          hint="Newest first. This is the section an ATS reads hardest. Internships count."
          onAdd={() => patch({ experience: [...content.experience, newExperience()] })}
          addId="add-experience"
          addLabel="Add a role"
        >
          {content.experience.length === 0 && <Empty>No roles yet. Fresher? Add internships and projects.</Empty>}
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
          id="section-projects"
          title="Projects"
          hint="Optional. Worth having when your experience is short."
          onAdd={() => patch({ projects: [...content.projects, newProject()] })}
          addId="add-project"
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
          id="section-education"
          title="Education"
          hint="Degree, institution, year and CGPA or percentage — a filter on most Indian applications."
          onAdd={() => patch({ education: [...content.education, newEducation()] })}
          addId="add-education"
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
          id="section-certifications"
          title="Certifications"
          hint="Optional."
          onAdd={() => patch({ certifications: [...content.certifications, newCertification()] })}
          addId="add-certification"
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

        {/* Sticks to the bottom of the screen on phones, so saving and the download are never a scroll away. */}
        <div className="border-line bg-bg/90 sticky bottom-0 z-10 -mx-4 border-t px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={status === "saving"}>
              Save resume
            </Button>
            <button type="button" onClick={download} className={buttonClass("secondary", "md", "gap-2")}>
              <Download className="size-4" aria-hidden />
              Download PDF
            </button>
            {storageEnabled && (lastSaved || status !== "idle") && (
              <button
                type="button"
                onClick={keepOnFile}
                disabled={fileState.busy}
                className={buttonClass("ghost", "md")}
              >
                {fileState.busy ? "Saving…" : "Keep as my resume on file"}
              </button>
            )}
          </div>
          <SaveState status={status} lastSaved={lastSaved} error={saveError} />
        </div>

        <p className="text-subtle text-xs">
          The download is built in your browser from what is on screen, so it always matches the preview.
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
        {job && gap && <TailorPanel job={job} gap={gap} onAddSkill={addSkill} />}
        <AtsReportPanel report={report} onFix={goTo} />
        <div id="section-preview" className="scroll-mt-6">
          <h2 className="text-fg mb-3 text-[15px] font-semibold">Preview</h2>
          <ResumePreview blocks={blocks} />
        </div>
      </div>
    </div>
  );
}

/** "2 roles, summary and 12 skills". */
function listOf(items: string[]) {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * Where the document stands. A polite live region, so a screen reader hears
 * "All changes saved" once rather than every keystroke's "Unsaved"; a failed
 * save is an alert, because it means their work is at risk.
 */
function SaveState({
  status,
  lastSaved,
  error,
}: {
  status: SaveStatus;
  lastSaved: string | null;
  error: string | null;
}) {
  if (status === "error") {
    return (
      <p role="alert" className="text-danger mt-2 flex items-center gap-1.5 text-xs">
        <CloudOff className="size-3.5 shrink-0" aria-hidden />
        {error}
      </p>
    );
  }
  return (
    <p role="status" className="text-subtle mt-2 flex min-h-4 items-center gap-1.5 text-xs">
      {status === "saving" && (
        <>
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
          Saving…
        </>
      )}
      {status === "saved" && lastSaved && (
        <>
          <Check className="text-ok size-3.5" aria-hidden />
          All changes saved at {savedTime.format(new Date(lastSaved))}
        </>
      )}
      {status === "unsaved" && "Unsaved changes — saving when you pause."}
      {status === "idle" &&
        (lastSaved
          ? `Last saved ${savedDate.format(new Date(lastSaved))}. Changes save as you type.`
          : "Nothing is stored until you change something. Then it saves as you type.")}
    </p>
  );
}

// ------------------------------------------------------------------ chrome

/** The header the resume prints, from the profile: shown so nobody wonders where to type their phone number. */
function ContactCard({ contact }: { contact: ResumeContact }) {
  const phone = formatPhone(contact.phone);
  const links = [contact.linkedinUrl, contact.githubUrl, contact.portfolioUrl].filter(Boolean).length;
  const missing = [!phone && "phone", !contact.city && "city", links === 0 && "LinkedIn"].filter(Boolean) as string[];
  return (
    <section className="metal rounded-3xl p-6" aria-labelledby="contact-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="contact-heading" className="text-fg text-[15px] font-semibold">
          Contact details
        </h2>
        <Link href="/account" className="text-muted hover:text-fg text-xs underline underline-offset-2">
          Edit on your profile
        </Link>
      </div>
      <p className="text-fg mt-2 text-sm font-medium">{contact.fullName}</p>
      <p className="text-muted mt-0.5 text-sm break-words">
        {[contact.city, phone, contact.email].filter(Boolean).join(" · ")}
      </p>
      {missing.length > 0 && (
        <p className="text-accent-fg mt-2 text-xs">
          Your resume has no {listOf(missing)} yet. Recruiters in India call before they email — add them on your
          profile.
        </p>
      )}
    </section>
  );
}

function Card({
  id,
  title,
  hint,
  children,
  onAdd,
  addId,
  addLabel,
}: {
  id: string;
  title: string;
  hint: string;
  children: React.ReactNode;
  onAdd?: () => void;
  addId?: string;
  addLabel?: string;
}) {
  return (
    <section id={id} className="metal scroll-mt-6 rounded-3xl p-6">
      <h2 className="text-fg text-[15px] font-semibold">{title}</h2>
      <p className="text-muted mt-1 mb-5 text-sm">{hint}</p>
      <div className="space-y-5">{children}</div>
      {onAdd && (
        <button type="button" id={addId} onClick={onAdd} className={buttonClass("secondary", "sm", "mt-5 gap-1.5")}>
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
  const icon = "rounded-full p-2 text-muted hover:bg-card hover:text-fg disabled:opacity-30";
  return (
    <div className="border-line rounded-2xl border p-4 sm:p-5">
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
  entryHint,
}: {
  id: string;
  value: string[];
  onChange: (bullets: string[]) => void;
  placeholder: string;
  entryHint?: Hint;
}) {
  const lines = bulletListHints(value);
  const hasHints = Boolean(entryHint) || lines.some((l) => l.length > 0);
  return (
    <div>
      <Label htmlFor={id}>What you did</Label>
      <Textarea
        id={id}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        className="min-h-28"
        placeholder={placeholder}
        aria-describedby={describedBy(`${id}-tip`, hasHints && `${id}-hints`)}
      />
      <p id={`${id}-tip`} className="text-subtle mt-1 text-xs">
        One bullet per line. Start with a verb, and put a number in where you can.
      </p>
      <LineHints id={`${id}-hints`} lines={lines} entry={entryHint} />
    </div>
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
  const hints = experienceHints(entry);
  const datesHint = hints.dates && id("dates-hint");

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
          <Input
            id={id("start")}
            type="month"
            value={entry.start}
            onChange={(e) => set({ start: e.target.value })}
            aria-describedby={datesHint}
            aria-invalid={hints.dates?.tone === "fail" && !entry.start ? true : undefined}
          />
        </Field>
        <Field id={id("end")} label="To">
          <Input
            id={id("end")}
            type="month"
            value={entry.end}
            disabled={entry.current}
            onChange={(e) => set({ end: e.target.value })}
            aria-describedby={datesHint}
          />
        </Field>
      </div>

      <div>
        <label className="text-muted flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={entry.current}
            onChange={(e) => set({ current: e.target.checked, end: e.target.checked ? "" : entry.end })}
            className="border-line bg-surface size-4 rounded"
          />
          I still work here
        </label>
        <HintText id={id("dates-hint")} hint={hints.dates} />
      </div>

      <Bullets
        id={id("bullets")}
        value={entry.bullets}
        onChange={(bullets) => set({ bullets })}
        entryHint={hints.bullets}
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
  const hints = educationHints(entry);

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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
            inputMode="numeric"
            value={entry.start}
            onChange={(e) => set({ start: e.target.value })}
            placeholder="2017"
          />
        </Field>
        <div>
          <Label htmlFor={id("end")}>To</Label>
          <Input
            id={id("end")}
            maxLength={24}
            inputMode="numeric"
            value={entry.end}
            onChange={(e) => set({ end: e.target.value })}
            placeholder="2021"
            aria-describedby={hints.end && id("end-hint")}
          />
          <HintText id={id("end-hint")} hint={hints.end} />
        </div>
        <div>
          <Label htmlFor={id("detail")}>CGPA or %</Label>
          <Input
            id={id("detail")}
            maxLength={120}
            value={entry.detail}
            onChange={(e) => set({ detail: e.target.value })}
            placeholder="CGPA 8.7/10"
            aria-describedby={hints.detail && id("detail-hint")}
          />
          <HintText id={id("detail-hint")} hint={hints.detail} />
        </div>
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
