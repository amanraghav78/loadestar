/**
 * Text metrics for the two base-14 fonts a resume needs, and the ASCII folding
 * that keeps the text layer of a generated PDF readable.
 *
 * Helvetica and Helvetica-Bold are built into every PDF reader, so nothing has
 * to be embedded: the file stays a few kilobytes, and its text is plain
 * single-byte WinAnsi — which is what an applicant tracking system reads.
 *
 * Pure and dependency-free, so wrapping and folding can be unit-tested without
 * producing a PDF at all. lib/pdf/write.ts is the only caller.
 */

export type PdfFont = "regular" | "bold";

/**
 * Advance widths in 1/1000 em for ASCII 32–126, from Adobe's AFM metrics.
 * Everything outside that range is folded away before it is measured, so one
 * table per font is all the file needs.
 */
const WIDTHS: Record<PdfFont, readonly number[]> = {
  regular: [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
    556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
    260, 334, 584,
  ],
  bold: [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611,
    556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
    280, 389, 584,
  ],
};

const FIRST_CODE = 32;

/** Width of one already-folded character, in points at the given size. */
function charWidth(code: number, font: PdfFont, size: number) {
  const width = WIDTHS[font][code - FIRST_CODE];
  return ((width ?? 0) / 1000) * size;
}

/** Width of a line of folded text, in points. */
export function measure(text: string, font: PdfFont, size: number) {
  let total = 0;
  for (let i = 0; i < text.length; i++) total += charWidth(text.charCodeAt(i), font, size);
  return total;
}

/**
 * What a character becomes when it can't be drawn. Typography a word processor
 * inserts silently — curly quotes, en dashes, the rupee sign — would otherwise
 * be dropped, and a resume that reads "18 LPA" instead of "₹18 LPA" is a worse
 * document than one that reads "Rs 18 LPA".
 */
const FOLD: Record<string, string> = {
  "–": "-", // – en dash
  "—": "-", // — em dash
  "−": "-", // − minus
  "‘": "'",
  "’": "'",
  "‚": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "…": "...",
  "•": "-", // • bullet
  "·": "-", // · middle dot
  "→": "->",
  "₹": "Rs ", // ₹
  " ": " ",
  " ": " ",
  " ": " ",
  "­": "",
};

/**
 * Text as it can actually be drawn: the substitutions above, accents stripped
 * rather than dropped ("José" → "Jose"), and anything still outside printable
 * ASCII removed.
 *
 * A script the base-14 fonts can't set at all — Devanagari, say — folds to
 * nothing, which is why `unrenderable()` exists and the ATS review warns about
 * it before the candidate downloads a resume with a hole in it.
 */
export function toPdfText(input: string) {
  let out = "";
  for (const char of input.normalize("NFKD").replace(/[̀-ͯ]/g, "")) {
    const folded = FOLD[char] ?? char;
    for (const c of folded) {
      const code = c.charCodeAt(0);
      if (code >= FIRST_CODE && code <= 126) out += c;
      else if (c === "\t") out += " ";
    }
  }
  return out;
}

/** The characters `toPdfText` would drop, deduplicated, for a warning worth acting on. */
export function unrenderable(input: string) {
  const lost = new Set<string>();
  for (const char of input) {
    if (char === "\n" || char === "\r" || char === "\t") continue;
    if (toPdfText(char) === "" && char.trim() !== "") lost.add(char);
  }
  return [...lost];
}

/**
 * Folded text broken into lines that fit `maxWidth`. Breaks on spaces; a single
 * word too long for the line (a URL, usually) is split rather than allowed to
 * run off the page.
 */
export function wrapText(text: string, font: PdfFont, size: number, maxWidth: number): string[] {
  const words = toPdfText(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = "";

  const pushSplit = (word: string) => {
    let part = "";
    for (const char of word) {
      if (measure(part + char, font, size) > maxWidth && part !== "") {
        lines.push(part);
        part = "";
      }
      part += char;
    }
    return part;
  };

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, font, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = measure(word, font, size) > maxWidth ? pushSplit(word) : word;
  }
  if (line) lines.push(line);
  return lines;
}
