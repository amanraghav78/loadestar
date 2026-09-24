"use client";

import { useState } from "react";
import { setRecruiterJobState } from "./actions";

type Status = "ACTIVE" | "PENDING" | "REJECTED" | "CLOSED" | "EXPIRED";

/**
 * Close, re-open and renew, as plain forms.
 *
 * Closing asks first: it takes a live role off the board, and a recruiter who
 * meant "edit" shouldn't lose their listing to a stray click.
 */
export function JobStateButtons({ id, status }: { id: string; status: Status }) {
  const [confirming, setConfirming] = useState(false);

  if (status === "CLOSED" || status === "EXPIRED") {
    return <Action id={id} intent="REOPEN" label={status === "CLOSED" ? "Re-open" : "Post again"} />;
  }

  if (status !== "ACTIVE") return null;

  return (
    <>
      <Action id={id} intent="RENEW" label="Still open" />
      {confirming ? (
        <span className="flex items-center gap-2">
          <Action id={id} intent="CLOSE" label="Confirm close" className="text-danger hover:text-danger" />
          <button type="button" onClick={() => setConfirming(false)} className="text-subtle hover:text-fg">
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-muted hover:text-fg">
          Close
        </button>
      )}
    </>
  );
}

function Action({
  id,
  intent,
  label,
  className = "text-muted hover:text-fg",
}: {
  id: string;
  intent: "CLOSE" | "REOPEN" | "RENEW";
  label: string;
  className?: string;
}) {
  return (
    <form action={setRecruiterJobState} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
