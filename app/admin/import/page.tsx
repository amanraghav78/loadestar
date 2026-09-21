import { ImportForm } from "./import-form";

const SAMPLE = `company_slug,title,discipline,level,tags,location,remote,remote_region,salary_min,salary_max,currency,apply_url,description
arclight,Senior Backend Engineer,engineering,senior,Go;Kafka,Berlin,onsite,,95000,125000,EUR,https://arclight.example/careers/123,"You'll own the ingest pipeline..."`;

export default function ImportPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">CSV import</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Upload or paste up to 500 roles. The import is all-or-nothing: if any row is invalid, nothing is saved and
        each problem is listed. Companies must exist first; use their slug from the Companies page.
      </p>
      <details className="mt-4 max-w-3xl rounded-lg border border-line bg-card p-3 text-sm">
        <summary className="cursor-pointer text-muted">Column format</summary>
        <pre className="mt-3 overflow-x-auto text-xs text-muted">{SAMPLE}</pre>
        <p className="mt-2 text-xs text-subtle">
          discipline: engineering, design, product, data, security, infrastructure · level: junior, mid, senior,
          staff, principal, manager, director · remote: onsite, hybrid, remote · tags separated by semicolons ·
          optional column: featured (true/false)
        </p>
      </details>
      <div className="mt-6">
        <ImportForm />
      </div>
    </>
  );
}
