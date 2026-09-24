import "server-only";

/**
 * Plain text out of a resume PDF, using a build of pdf.js meant for serverless
 * (unpdf: no native modules, no worker, no service to call). It runs in the
 * upload request, which is why everything here is bounded and why nothing it
 * does can fail the upload — see the caller in app/api/resume/route.ts.
 */

/** Enough for a long CV. Past this the text is a manual or a scanned book. */
const MAX_PAGES = 12;

/** A résumé with less text than this is a scan: there is nothing to read. */
const MIN_USEFUL_CHARS = 200;

export async function extractResumeText(bytes: Uint8Array): Promise<string | null> {
  // Imported lazily so the ~2 MB pdf.js build stays out of every other route's
  // bundle, and off the path of a deployment where uploads are turned off.
  const { extractText, getDocumentProxy } = await import("unpdf");

  // pdf.js takes ownership of the buffer it is handed, and the caller still
  // needs these bytes to store the file.
  const pdf = await getDocumentProxy(Uint8Array.from(bytes));
  if (pdf.numPages > MAX_PAGES) return null;

  const { text } = await extractText(pdf, { mergePages: true });
  const cleaned = text.replace(/\u0000/g, "").trim();
  return cleaned.length >= MIN_USEFUL_CHARS ? cleaned : null;
}
