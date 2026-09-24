import { wrapText, type PdfFont } from "@/lib/pdf/helvetica";
import { PAGE, writePdf, type PdfPage, type PdfRect, type PdfTextRun } from "@/lib/pdf/write";
import {
  layoutResume,
  type ResumeBlock,
  type ResumeBlockKind,
  type ResumeContact,
  type ResumeContent,
} from "@/lib/resume-builder";

/**
 * The candidate's resume as a PDF an applicant tracking system can read.
 *
 * One column, one font family, headings in the words parsers look for, and
 * every line a real string in the content stream — see lib/pdf/write.ts. The
 * layout deliberately has no table, no text box, no header/footer region and no
 * image: each of those is a common reason a resume arrives at an employer as an
 * empty record.
 *
 * Pure: content in, bytes out.
 */

const MARGIN = { top: 48, bottom: 52, x: 52 };
const CONTENT_WIDTH = PAGE.width - MARGIN.x * 2;

/** Hanging indent for bullets, so wrapped lines line up under the first word. */
const BULLET_INDENT = 12;
const BULLET_MARK = "-";

type Style = {
  size: number;
  font: PdfFont;
  /** Baseline-to-baseline distance within a wrapped block. */
  leading: number;
  spaceBefore: number;
  spaceAfter: number;
  indent?: number;
  uppercase?: boolean;
};

const STYLES: Record<ResumeBlockKind, Style> = {
  name: { size: 17, font: "bold", leading: 20, spaceBefore: 0, spaceAfter: 3 },
  headline: { size: 10.5, font: "regular", leading: 13, spaceBefore: 0, spaceAfter: 3 },
  contact: { size: 9.5, font: "regular", leading: 12, spaceBefore: 0, spaceAfter: 1 },
  heading: { size: 10.5, font: "bold", leading: 13, spaceBefore: 13, spaceAfter: 6, uppercase: true },
  entryTitle: { size: 10.5, font: "bold", leading: 13, spaceBefore: 7, spaceAfter: 1 },
  entryMeta: { size: 9.5, font: "regular", leading: 12, spaceBefore: 0, spaceAfter: 2 },
  bullet: { size: 10, font: "regular", leading: 12.8, spaceBefore: 0, spaceAfter: 2, indent: BULLET_INDENT },
  text: { size: 10, font: "regular", leading: 12.8, spaceBefore: 0, spaceAfter: 2 },
};

/** A heading or an entry title alone at the foot of a page belongs on the next one. */
const KEEP_WITH_NEXT: ResumeBlockKind[] = ["heading", "entryTitle"];
const ORPHAN_ROOM = 34;

type Sheet = { runs: PdfTextRun[]; rects: PdfRect[] };

/** Lays the blocks out top to bottom, breaking pages where the text runs out of room. */
export function paginate(blocks: ResumeBlock[]): PdfPage[] {
  const sheets: Sheet[] = [{ runs: [], rects: [] }];
  let sheet = sheets[0];
  let y = MARGIN.top;
  const floor = PAGE.height - MARGIN.bottom;

  const newPage = () => {
    sheet = { runs: [], rects: [] };
    sheets.push(sheet);
    y = MARGIN.top;
  };

  for (const block of blocks) {
    const style = STYLES[block.kind];
    const indent = style.indent ?? 0;
    const text = style.uppercase ? block.text.toUpperCase() : block.text;
    const lines = wrapText(text, style.font, style.size, CONTENT_WIDTH - indent);
    if (lines.length === 0) continue;

    const height = style.leading * lines.length;
    const needed = height + (KEEP_WITH_NEXT.includes(block.kind) ? ORPHAN_ROOM : 0);
    if (y > MARGIN.top && y + style.spaceBefore + needed > floor) newPage();
    else y += style.spaceBefore;

    // A hairline under each section heading. A filled rectangle is a drawing
    // operator, not a table: it carries no text and nothing reads it.
    if (block.kind === "heading") {
      sheet.rects.push({ x: MARGIN.x, y: y + style.size + 3, width: CONTENT_WIDTH, height: 0.6, gray: 0.35 });
    }

    lines.forEach((line, i) => {
      if (y + style.leading > floor && i > 0) newPage();
      const baseline = y + style.size;
      if (block.kind === "bullet" && i === 0) {
        sheet.runs.push({ x: MARGIN.x, y: baseline, size: style.size, font: style.font, text: BULLET_MARK });
      }
      sheet.runs.push({ x: MARGIN.x + indent, y: baseline, size: style.size, font: style.font, text: line });
      y += style.leading;
    });

    y += style.spaceAfter;
  }

  return sheets;
}

/** How many pages the resume runs to, for the ATS review. */
export function estimatePages(blocks: ResumeBlock[]) {
  return paginate(blocks).length;
}

/**
 * The filename the candidate's browser saves. Their own name, because that is
 * what a recruiter sees in a folder of a hundred attachments.
 */
export function resumeFileName(fullName: string) {
  const base = fullName
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return `${base || "Resume"} - Resume.pdf`;
}

export function buildResumePdf(content: ResumeContent, contact: ResumeContact): Uint8Array<ArrayBuffer> {
  const blocks = layoutResume(content, contact);
  return writePdf(paginate(blocks), {
    title: `${contact.fullName} - Resume`.trim(),
    author: contact.fullName,
  });
}
