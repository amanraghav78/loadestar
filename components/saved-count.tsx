"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useSavedJobs } from "@/lib/saved-jobs";

export function SavedCount() {
  const { ids } = useSavedJobs();
  return (
    <Link
      href="/saved"
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
    >
      <Bookmark className="size-3.5" aria-hidden />
      Saved
      <span className="tabular-nums text-fg" aria-label={`${ids.length} saved roles`}>
        {ids.length}
      </span>
    </Link>
  );
}
