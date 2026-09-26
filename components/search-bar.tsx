import Form from "next/form";
import { MapPin, Search } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Plain GET form (progressively enhanced by next/form) so search works
 * without JavaScript and every result page is a shareable URL.
 *
 * `lg` is the home-page hero. The compact `md` bar is a single row on phones
 * (keyword + button); the city field appears from `sm` up, and the results
 * page has city filters for small screens.
 *
 * `glow` (the home page) runs a band of light around the edge.
 */
export function SearchBar({
  q,
  location,
  size = "md",
  glow = false,
}: {
  q?: string;
  location?: string;
  size?: "md" | "lg";
  glow?: boolean;
}) {
  const lg = size === "lg";
  const field = cn(
    "w-full min-w-0 bg-transparent text-fg placeholder:text-subtle focus:outline-none",
    lg ? "h-11 text-[15px]" : "h-10 text-sm",
  );

  return (
    <Form
      action="/jobs"
      role="search"
      className={cn(
        "metal-panel relative flex p-1.5 sm:items-center",
        glow && "beam",
        lg ? "flex-col gap-1 rounded-3xl sm:flex-row sm:gap-0 sm:rounded-full" : "items-center rounded-full",
      )}
    >
      {glow && <span className="beam-ring" aria-hidden />}
      <label className="flex min-w-0 flex-[1.4] items-center gap-3 px-4">
        <Search className="text-subtle size-4 shrink-0" aria-hidden />
        <span className="sr-only">Job title, skill or company</span>
        <input name="q" defaultValue={q} placeholder="Job title, skill or company" maxLength={100} className={field} />
      </label>
      <span className="bg-line-strong hidden h-7 w-px sm:block" aria-hidden />
      <label
        className={cn(
          "min-w-0 flex-1 items-center gap-3 px-4",
          lg ? "border-line flex border-t sm:border-t-0" : "hidden sm:flex",
        )}
      >
        <MapPin className="text-subtle size-4 shrink-0" aria-hidden />
        <span className="sr-only">City or remote</span>
        <input name="location" defaultValue={location} placeholder="City or remote" maxLength={80} className={field} />
      </label>
      <button
        type="submit"
        className={cn("btn-chrome shrink-0 rounded-full font-semibold", lg ? "h-11 px-7 text-sm" : "h-10 px-5 text-sm")}
      >
        Search
      </button>
    </Form>
  );
}
