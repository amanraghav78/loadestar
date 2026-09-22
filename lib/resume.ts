/**
 * Resume file rules. Pure functions, so they can be unit-tested without a
 * database or a network: the upload route is the only caller.
 */

/** Vercel caps a function's request body at 4.5 MB; leave headroom for the form envelope. */
export const MAX_RESUME_BYTES = 4 * 1024 * 1024;

export const RESUME_ACCEPT = ".pdf,application/pdf";
export const RESUME_TYPE = "application/pdf";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/**
 * The file's own first bytes decide what it is. The upload's declared type and
 * its extension are attacker-controlled, so neither is trusted.
 *
 * PDF only for now: one unambiguous signature. DOCX is a ZIP container, which
 * is a lot more to reason about for a file we only ever store and hand back.
 */
export function sniffResumeType(bytes: Uint8Array): typeof RESUME_TYPE | null {
  if (bytes.length < PDF_MAGIC.length) return null;
  return PDF_MAGIC.every((byte, i) => bytes[i] === byte) ? RESUME_TYPE : null;
}

/**
 * A filename safe to put in a Content-Disposition header and show back to the
 * candidate: no path segments, no control characters or quotes (which would
 * let someone inject a header), and always a .pdf extension.
 */
export function sanitizeResumeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    // Control characters, quotes and backslashes: what a Content-Disposition
    // header injection would be built from.
    .replace(/[\u0000-\u001f\u007f"\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.pdf$/i, "")
    .slice(0, 100)
    .trim();
  return `${cleaned || "resume"}.pdf`;
}

/**
 * Where the file lives in the bucket. Namespaced by user so an operator can
 * sweep one candidate's files, and random so the key can't be guessed if the
 * bucket is ever misconfigured. Never derived from anything the user typed.
 */
export function resumeObjectKey(userId: string): string {
  return `resumes/${userId}/${crypto.randomUUID()}.pdf`;
}

export type ResumeRejection = "empty" | "too_large" | "not_a_pdf";

export const RESUME_ERROR: Record<ResumeRejection, string> = {
  empty: "That file is empty. Choose a PDF to upload.",
  too_large: "That file is over 4 MB. Choose a smaller PDF.",
  not_a_pdf: "That file isn't a PDF. Save your resume as a PDF and try again.",
};

/** Checks the bytes actually received, never the size the browser claimed. */
export function checkResumeBytes(bytes: Uint8Array): ResumeRejection | null {
  if (bytes.length === 0) return "empty";
  if (bytes.length > MAX_RESUME_BYTES) return "too_large";
  if (!sniffResumeType(bytes)) return "not_a_pdf";
  return null;
}
