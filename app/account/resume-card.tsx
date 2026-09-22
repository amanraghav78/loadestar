"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { MAX_RESUME_BYTES, RESUME_ACCEPT, RESUME_ERROR } from "@/lib/resume";

type Resume = { filename: string; size: number; updatedAt: string } | null;

const readable = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

export function ResumeCard({ resume, uploadEnabled }: { resume: Resume; uploadEnabled: boolean }) {
  const [current, setCurrent] = useState(resume);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function upload(file: File) {
    setError(null);
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
    setCurrent((await res.json()) as Resume);
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
      <h2 id="resume-heading" className="text-[15px] font-semibold text-fg">
        Resume
      </h2>
      <p className="mt-1 text-sm text-muted">
        PDF, up to 4 MB. Only you can download it — we never send it to employers.
      </p>

      {current ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3">
          <FileText className="size-5 shrink-0 text-subtle" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{current.filename}</p>
            <p className="text-xs text-subtle">{readable(current.size)}</p>
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
        <p className="mt-5 text-sm text-subtle">No resume yet.</p>
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
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
