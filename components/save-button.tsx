"use client";

import { Bookmark } from "lucide-react";
import { useSavedJobs } from "@/lib/saved-jobs";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";

export function SaveButton({
  jobId,
  jobTitle,
  variant = "icon",
  className,
}: {
  jobId: string;
  jobTitle: string;
  variant?: "icon" | "full";
  className?: string;
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
        className={buttonClass("secondary", "lg", className)}
      >
        <Bookmark className={cn("size-4", saved && "fill-current")} aria-hidden />
        {saved ? "Saved" : "Save"}
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
      className={cn(
        "hover:border-line-strong hover:text-fg relative z-10 -m-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-transparent transition-colors hover:bg-tint",
        saved ? "text-fg" : "text-subtle",
        className,
      )}
    >
      <Bookmark className={cn("size-4", saved && "fill-current")} aria-hidden />
    </button>
  );
}
