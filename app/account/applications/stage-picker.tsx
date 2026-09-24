"use client";

import { useActionState, useRef } from "react";
import { APPLICATION_STAGE_LABEL } from "@/lib/format";
import type { ApplicationStage } from "@/lib/generated/prisma/enums";
import { setApplicationStage, type FormState } from "../actions";

/**
 * The candidate's own stage for one application, plus a private note.
 *
 * The select submits its form on change, so the common case — moving a role to
 * "Interviewing" — is one interaction. There is a submit button as well, which
 * is what saves the note and what keeps this working without JavaScript.
 */
export function StagePicker({ jobId, stage, note }: { jobId: string; stage: ApplicationStage; note: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setApplicationStage, {});
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="jobId" value={jobId} />

      <label className="sr-only" htmlFor={`stage-${jobId}`}>
        Your stage for this application
      </label>
      <select
        id={`stage-${jobId}`}
        name="stage"
        defaultValue={stage}
        disabled={pending}
        onChange={() => form.current?.requestSubmit()}
        className="border-line bg-surface text-fg hover:border-line-strong focus:border-accent-fg/60 h-8 rounded-lg border px-2 text-xs focus:outline-none"
      >
        {Object.entries(APPLICATION_STAGE_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={`note-${jobId}`}>
        Your private note
      </label>
      <input
        id={`note-${jobId}`}
        name="note"
        defaultValue={note ?? ""}
        maxLength={500}
        placeholder="Add a note (only you see this)"
        className="border-line bg-surface text-fg placeholder:text-subtle hover:border-line-strong focus:border-accent-fg/60 h-8 min-w-0 flex-1 rounded-lg border px-2 text-xs focus:outline-none"
      />

      <button
        type="submit"
        disabled={pending}
        className="border-line-strong text-muted hover:text-fg h-8 rounded-lg border px-2.5 text-xs disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>

      {/* Politely announced: the row itself doesn't move, so a visual change alone would be easy to miss. */}
      <span role="status" className="text-subtle text-xs">
        {state.message}
      </span>
    </form>
  );
}
