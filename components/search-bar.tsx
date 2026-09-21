import Form from "next/form";
import { MapPin, Search } from "lucide-react";

/**
 * Plain GET form (progressively enhanced by next/form) so search works
 * without JavaScript and every result page is a shareable URL.
 */
export function SearchBar({ q, location }: { q?: string; location?: string }) {
  return (
    <Form
      action="/jobs"
      role="search"
      className="flex flex-col gap-2 metal-panel rounded-xl p-2 sm:flex-row sm:items-center sm:gap-0"
    >
      <label className="flex flex-1 items-center gap-2.5 px-3">
        <Search className="size-4 shrink-0 text-subtle" aria-hidden />
        <span className="sr-only">Job title, skill or company</span>
        <input
          name="q"
          defaultValue={q}
          placeholder="Job title, skill or company"
          maxLength={100}
          className="h-10 w-full bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
        />
      </label>
      <span className="hidden h-6 w-px bg-line sm:block" aria-hidden />
      <label className="flex flex-1 items-center gap-2.5 border-t border-line px-3 sm:border-t-0">
        <MapPin className="size-4 shrink-0 text-subtle" aria-hidden />
        <span className="sr-only">Location or remote</span>
        <input
          name="location"
          defaultValue={location}
          placeholder="Location or remote"
          maxLength={80}
          className="h-10 w-full bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="h-10 rounded-lg metal-button px-6 text-sm font-medium transition-colors"
      >
        Search
      </button>
    </Form>
  );
}
