import { toPdfText, type PdfFont } from "@/lib/pdf/helvetica";

/**
 * A minimal PDF writer: pages of positioned text in the two built-in Helvetica
 * faces, plus solid rectangles for rules.
 *
 * It exists so Lodestar can hand a candidate a resume whose text layer any
 * applicant tracking system can read. A screenshot in a PDF wrapper, or a file
 * built out of positioned table cells, is what "my resume scored zero" usually
 * turns out to be; every string here goes into the content stream as text, in
 * reading order, in one column.
 *
 * Nothing is compressed — a resume is a few kilobytes either way, and an
 * uncompressed stream is one a person can open in a text editor and check.
 * Pure: bytes in, bytes out, no I/O, so lib/resume-pdf.ts stays testable.
 */

/** A4, in points. India writes resumes on A4. */
export const PAGE = { width: 595.28, height: 841.89 };

/** `y` is the distance from the top of the page down to the text baseline. */
export type PdfTextRun = { x: number; y: number; size: number; font: PdfFont; text: string };

/** `y` is the distance from the top of the page down to the rectangle's top edge. */
export type PdfRect = { x: number; y: number; width: number; height: number; gray?: number };

export type PdfPage = { runs: PdfTextRun[]; rects?: PdfRect[] };

export type PdfMeta = { title: string; author: string };

const FONT_RESOURCE: Record<PdfFont, string> = { regular: "/F1", bold: "/F2" };

/** Backslashes and brackets end a PDF string early, so they are escaped. */
const escape = (text: string) => toPdfText(text).replace(/[\\()]/g, (c) => `\\${c}`);

const round = (n: number) => (Math.round(n * 100) / 100).toString();

function contentStream(page: PdfPage) {
  const ops: string[] = [];

  for (const rect of page.rects ?? []) {
    const gray = rect.gray ?? 0;
    ops.push(
      `${round(gray)} g ${round(rect.x)} ${round(PAGE.height - rect.y - rect.height)} ${round(rect.width)} ${round(
        rect.height,
      )} re f`,
    );
  }

  // One text object per run: a resume is short, and this keeps the stream
  // trivially readable when something needs debugging.
  for (const run of page.runs) {
    if (run.text === "") continue;
    ops.push(
      `BT ${FONT_RESOURCE[run.font]} ${round(run.size)} Tf 1 0 0 1 ${round(run.x)} ${round(
        PAGE.height - run.y,
      )} Tm (${escape(run.text)}) Tj ET`,
    );
  }

  return `0 g\n${ops.join("\n")}\n`;
}

/** Latin-1 out of a string we have already folded to ASCII, so one char is one byte. */
function toBytes(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

export function writePdf(pages: PdfPage[], meta: PdfMeta): Uint8Array<ArrayBuffer> {
  const sheets = pages.length > 0 ? pages : [{ runs: [] }];

  // 1 catalog, 2 page tree, 3–4 fonts, 5 document info, then a page object and
  // a content stream for each sheet.
  const firstPageObject = 6;
  const kids = sheets.map((_, i) => `${firstPageObject + i * 2} 0 R`).join(" ");
  const date = `D:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;

  const objects: string[] = [
    // /Lang tells a reader — and a parser guessing at hyphenation — what it is reading.
    "<</Type/Catalog/Pages 2 0 R/Lang(en-IN)>>",
    `<</Type/Pages/Kids[${kids}]/Count ${sheets.length}>>`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>",
    `<</Title(${escape(meta.title)})/Author(${escape(meta.author)})/Creator(Lodestar)/Producer(Lodestar)/CreationDate(${date})>>`,
  ];

  sheets.forEach((page, i) => {
    const contents = contentStream(page);
    objects.push(
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${round(PAGE.width)} ${round(PAGE.height)}]` +
        `/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents ${firstPageObject + i * 2 + 1} 0 R>>`,
    );
    objects.push(`<</Length ${contents.length}>>\nstream\n${contents}endstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R/Info 5 0 R>>\nstartxref\n${xref}\n%%EOF\n`;

  return toBytes(pdf);
}
