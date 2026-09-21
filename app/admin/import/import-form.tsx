"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { importJobs, type FormState } from "../actions";

export function ImportForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(importJobs, {});
  const rowErrors = state.errors?.rows;

  return (
    <form action={action} className="max-w-3xl space-y-4">
      <div>
        <Label htmlFor="file">CSV file</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          className="block text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-card file:px-3 file:py-1.5 file:text-fg"
        />
      </div>
      <div>
        <Label htmlFor="csv">…or paste CSV</Label>
        <Textarea id="csv" name="csv" rows={10} className="font-mono text-xs" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Importing…" : "Import"}
      </Button>

      {state.message && (
        <div role="status" className="rounded-lg border border-line-strong bg-card p-4 text-sm">
          <p className={rowErrors ? "text-danger" : "text-ok"}>{state.message}</p>
          {rowErrors && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
              {rowErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
