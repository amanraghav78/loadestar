"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useSavedJobs } from "@/lib/saved-jobs";

export function SavedCount() {
  const { ids } = useSavedJobs();
  return (
    <Link
      href="/saved"
      className="btn-steel inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
    >
      <Bookmark className="size-3.5" aria-hidden />
      Saved
      {/* A count only once there is something to count; "0" reads as noise. */}
      {ids.length > 0 && (
        <span
          className="text-fg bg-tint-strong min-w-4 rounded-full px-1.5 text-center text-[11px] tabular-nums"
          aria-label={`${ids.length} saved roles`}
        >
          {ids.length}
        </span>
      )}
    </Link>
  );
}
