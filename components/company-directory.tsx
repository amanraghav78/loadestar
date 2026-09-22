"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Search } from "lucide-react";
import { CompanyAvatar } from "@/components/company-avatar";
import { numberFormat } from "@/lib/format";

type Company = { slug: string; name: string; logoUrl: string | null; openRoles: number };

/** Company grid with an instant name filter. */
export function CompanyDirectory({ companies }: { companies: Company[] }) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const shown = q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies;

  return (
    <>
      <label className="metal-panel mt-8 flex h-12 max-w-md items-center gap-3 rounded-full px-4">
        <Search className="size-4 shrink-0 text-subtle" aria-hidden />
        <span className="sr-only">Search companies</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies"
          className="h-full w-full bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
        />
      </label>

      {shown.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No company matches &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((c) => (
            <li key={c.slug} className="flex min-w-0">
              <Link
                href={`/companies/${c.slug}`}
                className="metal-card flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3.5"
              >
                <CompanyAvatar name={c.name} logoUrl={c.logoUrl} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-fg">{c.name}</span>
                  <span className="block text-xs text-subtle tabular-nums">
                    {numberFormat.format(c.openRoles)} {c.openRoles === 1 ? "job" : "jobs"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
