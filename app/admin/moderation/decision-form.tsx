"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { FormState } from "../actions";

type Decider = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Approve / turn down, for one queued item.
 *
 * Approving is one click. Turning something down asks for a reason first,
 * because the reason is what the recruiter or reviewer is shown — and because
 * an accidental refusal is the expensive mistake here.
 */
export function DecisionForm({ id, action }: { id: string; action: Decider }) {
  const [state, submit, pending] = useActionState<FormState, FormData>(action, {});
  const [rejecting, setRejecting] = useState(false);

  if (state.message) {
    return (
      <p role="status" className="text-muted text-xs">
        {state.message}
      </p>
    );
  }

  return (
    <form action={submit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />

      {rejecting ? (
        <>
          <Input
            name="reviewNote"
            required
            maxLength={500}
            placeholder="Why? They will see this."
            className="h-8 w-64 text-xs"
            aria-label="Reason"
          />
          <input type="hidden" name="decision" value="REJECTED" />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {pending ? "Sending…" : "Turn down"}
          </Button>
          <button type="button" onClick={() => setRejecting(false)} className="text-subtle hover:text-fg text-xs">
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            type="submit"
            name="decision"
            value="APPROVED"
            disabled={pending}
            className="text-ok text-xs hover:underline"
          >
            {pending ? "Saving…" : "Approve"}
          </button>
          <button type="button" onClick={() => setRejecting(true)} className="text-muted hover:text-fg text-xs">
            Turn down
          </button>
        </>
      )}

      {state.errors?.reviewNote?.[0] && <p className="text-danger text-xs">{state.errors.reviewNote[0]}</p>}
    </form>
  );
}
