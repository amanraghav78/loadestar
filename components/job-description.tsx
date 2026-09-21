import type { ReactNode } from "react";

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

    if (lines[0]!.startsWith("## ")) {
      out.push(<h3 key={`h${i}`}>{lines[0]!.slice(3)}</h3>);
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
