/**
 * The resume a candidate builds on Lodestar: what it holds, and the order it
 * reads in.
 *
 * `layoutResume` turns a stored document plus the contact details already on
 * the profile into a flat list of blocks. Both the on-screen preview and the
 * PDF render that same list, so what a candidate downloads is what they were
 * looking at — and the reading order an ATS sees is the one they proof-read.
 *
 * Pure and dependency-free: it runs in the browser for the live preview and on
 * the server for the download, and is unit-testable without either.
 */

export type ResumeExperience = {
  role: string;
  company: string;
  location: string;
  /** As typed, or "YYYY-MM" from the month input. `formatResumeDate` reads both. */
  start: string;
  end: string;
  /** Still there: overrides `end` with "Present". */
  current: boolean;
  bullets: string[];
};

export type ResumeEducation = {
  degree: string;
  institution: string;
  location: string;
  start: string;
  end: string;
  /** "CGPA 8.7", "First class" — whatever the candidate wants to carry. */
  detail: string;
};

export type ResumeProject = {
  name: string;
  link: string;
  bullets: string[];
};

export type ResumeCertification = {
  name: string;
  issuer: string;
  year: string;
};

export type ResumeContent = {
  /** The role being applied for, under the name. ATS and humans both read it first. */
  headline: string;
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  certifications: ResumeCertification[];
};

/** Everything the header needs, all of it already on the candidate's profile. */
export type ResumeContact = {
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
};

/**
 * Blank entries, as functions rather than constants: an entry holds a list of
 * bullets, and handing every new row the same array is the kind of sharing that
 * only shows itself much later.
 */
export const newExperience = (): ResumeExperience => ({
  role: "",
  company: "",
  location: "",
  start: "",
  end: "",
  current: false,
  bullets: [""],
});

export const newEducation = (): ResumeEducation => ({
  degree: "",
  institution: "",
  location: "",
  start: "",
  end: "",
  detail: "",
});

export const newProject = (): ResumeProject => ({ name: "", link: "", bullets: [""] });

export const newCertification = (): ResumeCertification => ({ name: "", issuer: "", year: "" });

/** An empty document. Read-only: every caller spreads it rather than editing it. */
export const EMPTY_RESUME: ResumeContent = Object.freeze({
  headline: "",
  summary: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
  certifications: [],
});

// ------------------------------------------------------------------ dates

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2021-03" → "Mar 2021", "2021" → "2021". Anything else is handed back as
 * typed: a resume that says "Summer 2022" should keep saying it.
 */
export function formatResumeDate(value: string) {
  const text = value.trim();
  const month = /^(\d{4})-(\d{1,2})$/.exec(text);
  if (month) {
    const index = Number(month[2]) - 1;
    if (index >= 0 && index < 12) return `${MONTHS[index]} ${month[1]}`;
  }
  return text;
}

/** "Mar 2020 – Present", "2019 – 2021", or one end of it when that is all there is. */
export function formatDateRange(start: string, end: string, current = false) {
  const from = formatResumeDate(start);
  const to = current ? "Present" : formatResumeDate(end);
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

/** "Bengaluru · Mar 2020 – Present" — the parts of it that exist, in that order. */
const metaLine = (...parts: Array<string | null | undefined>) => parts.filter((p) => p && p.trim()).join(" · ");

// ------------------------------------------------------------------ layout

export type ResumeBlockKind =
  "name" | "headline" | "contact" | "heading" | "entryTitle" | "entryMeta" | "bullet" | "text";

export type ResumeBlock = { kind: ResumeBlockKind; text: string };

const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

/** A link without its scheme: "linkedin.com/in/ada" reads better than the full URL. */
function shortLink(url: string | null) {
  const text = clean(url);
  if (!text) return "";
  return text
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

/**
 * The document, in reading order.
 *
 * Section headings are the plain words an ATS is looking for — Summary, Skills,
 * Experience, Projects, Education, Certifications — because a parser that
 * doesn't recognise a heading files everything under it as nothing.
 */
export function layoutResume(content: ResumeContent, contact: ResumeContact): ResumeBlock[] {
  const blocks: ResumeBlock[] = [];
  const push = (kind: ResumeBlockKind, text: string) => {
    const value = clean(text);
    if (value) blocks.push({ kind, text: value });
  };

  push("name", contact.fullName);
  push("headline", content.headline);

  push("contact", metaLine(contact.city, contact.phone, contact.email));
  push(
    "contact",
    metaLine(shortLink(contact.linkedinUrl), shortLink(contact.githubUrl), shortLink(contact.portfolioUrl)),
  );

  if (clean(content.summary)) {
    push("heading", "Summary");
    push("text", content.summary);
  }

  const skills = content.skills.map(clean).filter(Boolean);
  if (skills.length > 0) {
    push("heading", "Skills");
    // One comma-separated line, not a grid: columns are what parsers read out
    // of order, and this is the section they most need to get right.
    push("text", skills.join(", "));
  }

  const experience = content.experience.filter((e) => clean(e.role) || clean(e.company));
  if (experience.length > 0) {
    push("heading", "Experience");
    for (const entry of experience) {
      push("entryTitle", metaLine(entry.role, entry.company));
      push("entryMeta", metaLine(entry.location, formatDateRange(entry.start, entry.end, entry.current)));
      for (const bullet of entry.bullets) push("bullet", bullet);
    }
  }

  const projects = content.projects.filter((p) => clean(p.name));
  if (projects.length > 0) {
    push("heading", "Projects");
    for (const project of projects) {
      push("entryTitle", project.name);
      push("entryMeta", shortLink(project.link));
      for (const bullet of project.bullets) push("bullet", bullet);
    }
  }

  const education = content.education.filter((e) => clean(e.degree) || clean(e.institution));
  if (education.length > 0) {
    push("heading", "Education");
    for (const entry of education) {
      push("entryTitle", metaLine(entry.degree, entry.institution));
      push("entryMeta", metaLine(entry.location, formatDateRange(entry.start, entry.end), entry.detail));
    }
  }

  const certifications = content.certifications.filter((c) => clean(c.name));
  if (certifications.length > 0) {
    push("heading", "Certifications");
    for (const cert of certifications) push("text", metaLine(cert.name, cert.issuer, cert.year));
  }

  return blocks;
}

/** Every word in the document, for the checks that read it as a whole. */
export function resumePlainText(content: ResumeContent, contact: ResumeContact) {
  return layoutResume(content, contact)
    .map((block) => block.text)
    .join("\n");
}

/** The bullets of every experience entry and project, which is what gets reviewed. */
export function allBullets(content: ResumeContent) {
  return [...content.experience, ...content.projects].flatMap((entry) => entry.bullets.map(clean)).filter(Boolean);
}
