"use client";

import { useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import type { ResumeContent } from "@/lib/resume-builder";
import { buttonClass } from "@/components/ui/button";

/**
 * The first-run card: start from a resume the candidate already has instead of
 * a blank page. The PDF is read on the server (app/api/resume/import) and
 * comes back as sections; nothing is stored until the builder saves it, and
 * the builder only fills what is still empty (lib/resume-prefill mergeResume).
 */
export function ResumeStart({
  uploadedFilename,
  onImport,
  onDismiss,
}: {
  /** The PDF on their profile, when there is one to read. */
  uploadedFilename: string | null;
  onImport: (content: ResumeContent) => void;
  onDismiss: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File | null) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    if (file) body.set("file", file);
    try {
      const res = await fetch("/api/resume/import", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { content?: ResumeContent; error?: string };
      if (!res.ok || !data.content) setError(data.error ?? "That didn't work. Please try again.");
      else onImport(data.content);
    } catch {
      setError("That didn't work. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="metal relative rounded-3xl p-6" aria-labelledby="resume-start-heading">
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted hover:bg-card hover:text-fg absolute top-4 right-4 rounded-full p-1.5"
        aria-label="Hide this and type it in"
      >
        <X className="size-4" aria-hidden />
      </button>
      <h2 id="resume-start-heading" className="text-fg pr-8 text-[15px] font-semibold">
        Already have a resume?
      </h2>
      <p className="text-muted mt-1 text-sm">
        We&apos;ll read it into the sections below so you edit instead of retyping. Only empty sections are filled, and
        nothing is kept until you change something.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {uploadedFilename && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void read(null)}
            className={buttonClass("secondary", "sm", "max-w-full gap-1.5")}
          >
            <FileUp className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">Use {uploadedFilename}</span>
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={buttonClass(uploadedFilename ? "ghost" : "secondary", "sm", "gap-1.5")}
        >
          {!uploadedFilename && <FileUp className="size-3.5" aria-hidden />}
          {busy ? "Reading…" : uploadedFilename ? "Upload a different PDF" : "Upload a PDF"}
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void read(e.target.files?.[0] ?? null)}
        />
      </div>
      {error && (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
