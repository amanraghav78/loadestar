const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  bull: "•",
  middot: "·",
  rupee: "₹",
  euro: "€",
  pound: "£",
};

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

/**
 * Converts job-board HTML into the plain description format the site renders
 * (blank-line paragraphs, "## " headings, "- " bullets). No HTML survives, so
 * nothing from a feed can inject markup into our pages.
 */
export function htmlToText(html: string, maxLength = 20_000) {
  let s = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner: string) => `\n\n## ${stripTags(inner).trim()}\n\n`)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|ul|ol|section|table|tr|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");

  s = decodeEntities(s).replace(/ /g, " ");

  const lines = s.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim());
  const out: string[] = [];
  for (const line of lines) {
    if (line === "-" || line === "## ") continue;
    // A bold one-liner followed by content reads as a heading on most boards.
    out.push(line);
  }

  const text = out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    // Keep bullet runs contiguous so the renderer turns them into one list.
    .replace(/(\n- [^\n]+)\n\n(?=- )/g, "$1\n")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

function stripTags(s: string) {
  return decodeEntities(s.replace(/<[^>]+>/g, ""));
}
