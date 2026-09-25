import type { ReactNode } from "react";

/**
 * The heading a line stands for, or null when it is ordinary text.
 *
 * "## " is ours. Most careers sites don't use real headings, though: they bold
 * a short label ending in a colon ("What you'll do:"), which reaches us as a
 * plain line. Treating those as headings too is what makes a long posting
 * scannable. The limits keep a sentence that happens to end in a colon, or a
 * bullet, from being promoted.
 */
export function headingText(line: string): string | null {
  if (line.startsWith("## ")) return line.slice(3).trim() || null;
  if (line.startsWith("- ") || line.length > 60 || !line.endsWith(":")) return null;
  const label = line.slice(0, -1).trim();
  if (!label || label.split(/\s+/).length > 8 || /[.!?]/.test(label)) return null;
  return label;
}

/**
 * Renders the lightweight description format used in the admin editor:
 * blank-line separated paragraphs, "## " headings and "- " bullet lists.
 * Builds React elements directly, so there is no HTML injection path.
 */
export function JobDescription({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: ReactNode[] = [];

  blocks.forEach((block, i) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const heading = headingText(lines[0]!);
    if (heading) {
      out.push(<h3 key={`h${i}`}>{heading}</h3>);
      lines.shift();
      if (lines.length === 0) return;
    }

    if (lines.every((l) => l.startsWith("- "))) {
      out.push(
        <ul key={`u${i}`}>
          {lines.map((l, j) => (
            <li key={j}>{l.slice(2)}</li>
          ))}
        </ul>,
      );
    } else {
      out.push(<p key={`p${i}`}>{lines.join(" ")}</p>);
    }
  });

  return <div className="prose-job text-[15px]">{out}</div>;
}

/** Plain-text version for meta descriptions. */
export function descriptionToPlainText(text: string, max = 160) {
  const plain = text
    .replace(/^(## |- )/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}
