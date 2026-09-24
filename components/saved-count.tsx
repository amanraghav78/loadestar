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
      <span
        className="text-fg min-w-4 rounded-full bg-tint-strong px-1.5 text-center text-[11px] tabular-nums"
        aria-label={`${ids.length} saved roles`}
      >
        {ids.length}
      </span>
    </Link>
  );
}
