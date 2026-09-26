import { AlertTriangle, X } from "lucide-react";
import type { Hint } from "@/lib/resume-suggestions";

/**
 * A suggestion printed under the field it is about (see lib/resume-suggestions).
 *
 * The field points at it with aria-describedby, so a screen reader reads the
 * advice with the input instead of it being a stray paragraph. It is not a live
 * region: it changes on every keystroke, and announcing each change would talk
 * over the typing.
 */
export function HintText({ id, hint }: { id: string; hint: Hint | undefined }) {
  if (!hint) return null;
  const Icon = hint.tone === "fail" ? X : AlertTriangle;
  return (
    <p id={id} className={`mt-1.5 flex gap-1.5 text-xs ${hint.tone === "fail" ? "text-danger" : "text-accent-fg"}`}>
      <Icon className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span>{hint.text}</span>
    </p>
  );
}

/** Hints for a bullets box, one row per line that has something to fix. */
export function LineHints({ id, lines, entry }: { id: string; lines: Hint[][]; entry?: Hint }) {
  const rows = lines.flatMap((hints, i) => (hints.length > 0 ? [{ line: i + 1, hints }] : []));
  if (rows.length === 0 && !entry) return null;
  return (
    <div id={id} className="mt-1.5 space-y-1">
      {entry && <HintText id={`${id}-entry`} hint={entry} />}
      {rows.length > 0 && (
        <ul className="space-y-1">
          {rows.slice(0, 6).map(({ line, hints }) => (
            <li key={line} className="text-accent-fg flex gap-1.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>
                <span className="text-muted font-medium">Line {line}:</span> {hints.map((h) => h.text).join(" ")}
              </span>
            </li>
          ))}
          {rows.length > 6 && <li className="text-subtle pl-4.5 text-xs">and {rows.length - 6} more lines.</li>}
        </ul>
      )}
    </div>
  );
}

/** The ids a field's aria-describedby should list, skipping hints that aren't showing. */
export const describedBy = (...ids: Array<string | false | undefined>) =>
  ids.filter((id): id is string => Boolean(id)).join(" ") || undefined;
