"use client";

import { useState } from "react";
import { signOut } from "@/lib/auth-client";
import { clearSavedJobs } from "@/lib/saved-jobs";
import { buttonClass } from "@/components/ui/button";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass("ghost", "sm")}
      onClick={async () => {
        setPending(true);
        await signOut();
        // Leave nothing behind on a shared computer.
        clearSavedJobs();
        // A full load, not a client navigation: the router keeps privately
        // cached segments (the header among them) in memory for their stale
        // window, which would still show the account after signing out.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate: drops the client router cache
        window.location.assign("/");
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
