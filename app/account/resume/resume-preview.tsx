import type { ResumeBlock } from "@/lib/resume-builder";

/**
 * The resume as it will print: the same blocks `buildResumePdf` lays out, in
 * the same order, on a sheet of paper rather than in the dark UI around it.
 *
 * Nothing here is styled per section by hand — one list of blocks, one style
 * per kind — so the preview cannot drift from the file the candidate downloads.
 */

/** Consecutive bullets become one list, which is what they are. */
type Group = { kind: "bullets"; items: string[] } | { kind: "block"; block: ResumeBlock };

function group(blocks: ResumeBlock[]): Group[] {
  const groups: Group[] = [];
  for (const block of blocks) {
    const last = groups.at(-1);
    if (block.kind === "bullet") {
      if (last?.kind === "bullets") last.items.push(block.text);
      else groups.push({ kind: "bullets", items: [block.text] });
    } else {
      groups.push({ kind: "block", block });
    }
  }
  return groups;
}

export function ResumePreview({ blocks }: { blocks: ResumeBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="border-line bg-surface text-subtle rounded-2xl border p-8 text-center text-sm">
        Your resume will appear here as you write it.
      </div>
    );
  }

  return (
    <div
      // A sheet of paper, deliberately: the point of the preview is that this
      // is the document, not a styled version of the form.
      className="rounded-2xl bg-white px-8 py-9 text-[#18181b] shadow-[var(--shadow-panel)]"
      aria-label="Resume preview"
    >
      {group(blocks).map((entry, i) =>
        entry.kind === "bullets" ? (
          <ul key={i} className="mt-1.5 list-outside list-disc space-y-1 pl-4">
            {entry.items.map((item, j) => (
              <li key={j} className="text-[11.5px] leading-[1.45] marker:text-[#71717a]">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <Block key={i} block={entry.block} />
        ),
      )}
    </div>
  );
}

function Block({ block }: { block: ResumeBlock }) {
  switch (block.kind) {
    case "name":
      return <p className="text-[20px] leading-tight font-bold tracking-[-0.01em]">{block.text}</p>;
    case "headline":
      return <p className="mt-0.5 text-[12.5px] leading-snug">{block.text}</p>;
    case "contact":
      return <p className="mt-0.5 text-[11px] leading-snug text-[#3f3f46]">{block.text}</p>;
    case "heading":
      return (
        <h3 className="mt-5 border-b border-[#a1a1aa] pb-1 text-[11px] font-bold tracking-[0.08em] uppercase">
          {block.text}
        </h3>
      );
    case "entryTitle":
      return <p className="mt-3 text-[12px] font-bold">{block.text}</p>;
    case "entryMeta":
      return <p className="text-[11px] text-[#3f3f46]">{block.text}</p>;
    default:
      return <p className="mt-1.5 text-[11.5px] leading-[1.45]">{block.text}</p>;
  }
}
