"use client";

import { Bookmark } from "lucide-react";
import { useSavedJobs } from "@/lib/saved-jobs";
import { cn } from "@/lib/cn";

export function SaveButton({
  jobId,
  jobTitle,
  variant = "icon",
}: {
  jobId: string;
  jobTitle: string;
  variant?: "icon" | "full";
}) {
  const { isSaved, toggle } = useSavedJobs();
  const saved = isSaved(jobId);
  const label = saved ? `Remove ${jobTitle} from saved roles` : `Save ${jobTitle}`;

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={() => toggle(jobId)}
        aria-pressed={saved}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-card px-4 text-sm font-medium text-fg transition-colors hover:bg-card-hover"
      >
        <Bookmark className={cn("size-4", saved && "fill-current")} aria-hidden />
        {saved ? "Saved" : "Save role"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(jobId)}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      // Sits above the card's stretched link.
      className="relative z-10 -m-1.5 rounded-md p-1.5 text-muted transition-colors hover:bg-card-hover hover:text-fg"
    >
      <Bookmark className={cn("size-4", saved && "fill-current text-fg")} aria-hidden />
    </button>
  );
}
