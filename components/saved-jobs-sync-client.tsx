"use client";

import { useEffect, useRef } from "react";
import { applySession } from "@/lib/saved-jobs";

/**
 * Runs once per session change: works out what this browser's saved roles
 * should now be, and pushes anything collected before signing in to the
 * account. Renders nothing.
 */
export function SavedJobsSyncClient({ userId, serverIds }: { userId: string | null; serverIds: string[] }) {
  const done = useRef<string | null>(null);
  const key = `${userId ?? "anon"}:${serverIds.join(",")}`;

  useEffect(() => {
    if (done.current === key) return;
    done.current = key;

    const toUpload = applySession(userId, serverIds);
    if (userId && toUpload.length) {
      void fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merge: toUpload }),
      }).catch(() => {});
    }
  }, [key, userId, serverIds]);

  return null;
}
