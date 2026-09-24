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
          className="text-muted file:border-line-strong file:bg-card file:text-fg block text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5"
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
        <div role="status" className="border-line-strong bg-card rounded-lg border p-4 text-sm">
          <p className={rowErrors ? "text-danger" : "text-ok"}>{state.message}</p>
          {rowErrors && (
            <ul className="text-muted mt-2 list-disc space-y-1 pl-5 text-xs">
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
