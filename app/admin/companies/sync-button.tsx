"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { syncNow, type SyncState } from "../actions";

export function SyncButton() {
  const [state, action, pending] = useActionState<SyncState, FormData>(syncNow, {});
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Syncing… (up to a few minutes)" : "Sync all feeds now"}
      </Button>
      {state.message && (
        <div role="status" className="text-xs text-muted">
          <p className="text-ok">{state.message}</p>
          {state.failed?.map((f) => (
            <p key={f} className="text-danger">
              {f}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}
