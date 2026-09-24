"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { MAX_RESUME_BYTES, RESUME_ACCEPT, RESUME_ERROR } from "@/lib/resume";
import type { ResumeSuggestions } from "@/lib/resume-parse";

export type Resume = { filename: string; size: number; updatedAt: string } | null;

/** What POST /api/resume answers with. */
type UploadResult = NonNullable<Resume> & {
  suggestions: ResumeSuggestions | null;
  suggestionCount: number;
};

const readable = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

export function ResumeCard({
  resume,
  uploadEnabled,
  onSuggestions,
}: {
  resume: Resume;
  uploadEnabled: boolean;
  /** Called with whatever we could read out of the PDF, for the form to offer. */
  onSuggestions?: (suggestions: ResumeSuggestions) => void;
}) {
  const [current, setCurrent] = useState(resume);
  const [error, setError] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function upload(file: File) {
    setError(null);
    setUnreadable(false);
    // Saves a pointless round trip; the server checks the bytes regardless.
    if (file.size > MAX_RESUME_BYTES) {
      setError(RESUME_ERROR.too_large);
      return;
    }
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/resume", { method: "POST", body });
    setBusy(false);
    if (!res.ok) {
      const { error: message } = (await res.json().catch(() => ({}))) as { error?: string };
      setError(message ?? "That upload didn't work. Please try again.");
      return;
    }
    const result = (await res.json()) as UploadResult;
    setCurrent({ filename: result.filename, size: result.size, updatedAt: result.updatedAt });
    // A scanned or otherwise unreadable PDF is stored all the same; we just say
    // so, rather than leaving the candidate wondering why nothing filled in.
    if (result.suggestions) onSuggestions?.(result.suggestions);
    else setUnreadable(true);
    startTransition(() => router.refresh());
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/resume", { method: "DELETE" });
    setBusy(false);
    setCurrent(null);
    startTransition(() => router.refresh());
  }

  return (
    <section className="metal rounded-3xl p-6" aria-labelledby="resume-heading">
      <h2 id="resume-heading" className="text-fg text-[15px] font-semibold">
        Resume
      </h2>
      <p className="text-muted mt-1 text-sm">
        PDF, up to 4 MB. Only you can download it — we never send it to employers. We read it once to fill in your
        profile below, which you can then edit. Nothing to upload?{" "}
        <Link href="/account/resume" className="underline underline-offset-2">
          write one here
        </Link>{" "}
        and we&rsquo;ll check it reads properly to an ATS.
      </p>

      {current ? (
        <div className="border-line mt-5 flex flex-wrap items-center gap-3 rounded-2xl border p-3">
          <FileText className="text-subtle size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-fg truncate text-sm font-medium">{current.filename}</p>
            <p className="text-subtle text-xs">{readable(current.size)}</p>
          </div>
          <a href="/api/resume" className={buttonClass("secondary", "sm", "gap-1.5")}>
            <Download className="size-3.5" aria-hidden />
            Download
          </a>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className={buttonClass("ghost", "sm", "gap-1.5")}
            aria-label={`Remove ${current.filename}`}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Remove
          </button>
        </div>
      ) : (
        <p className="text-subtle mt-5 text-sm">No resume yet.</p>
      )}

      {uploadEnabled && (
        <div className="mt-5">
          <input
            ref={input}
            type="file"
            accept={RESUME_ACCEPT}
            className="sr-only"
            aria-label="Choose a resume PDF"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className={buttonClass("primary", "md", "gap-2")}
          >
            <Upload className="size-4" aria-hidden />
            {busy ? "Uploading…" : current ? "Replace resume" : "Upload resume"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      )}

      {unreadable && !error && (
        <p role="status" className="text-subtle mt-3 text-sm">
          Saved, but we couldn&rsquo;t read any text from it &mdash; a scanned resume is a picture to us. Fill the
          profile in below and matching will still work.
        </p>
      )}
    </section>
  );
}
