"use client";

import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { deleteAccount, type FormState } from "./actions";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, {});

  return (
    <section className="rounded-3xl border border-danger/30 p-6" aria-labelledby="delete-heading">
      <h2 id="delete-heading" className="text-[15px] font-semibold text-fg">
        Delete your account
      </h2>
      <p className="mt-1 text-sm text-muted">
        Removes your profile, your resume file, your saved roles and your applied roles. This can&rsquo;t be undone.
      </p>

      {open ? (
        <form action={action} className="mt-5 max-w-sm space-y-3" noValidate>
          <Label htmlFor="confirm">Type DELETE to confirm</Label>
          <Input id="confirm" name="confirm" autoComplete="off" required />
          {state.message && (
            <p role="alert" className="text-xs text-danger">
              {state.message}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>
              {pending ? "Deleting…" : "Delete my account"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("ghost", "sm", "mt-4")}>
          Delete account
        </button>
      )}
    </section>
  );
}
