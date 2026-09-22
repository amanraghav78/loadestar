import { Chip } from "@/components/ui/tag";
import { DISCIPLINE_LABEL, LEVEL_LABEL, REMOTE_LABEL } from "@/lib/format";
import { INDIA_CITIES } from "@/lib/ingest/classify";
import { toQueryString, type JobSearchParams } from "@/lib/validators";

type Key = "city" | "discipline" | "level" | "remote" | "salary";

/** Cities shown up front; the rest sit under "More cities". */
const TOP_CITIES = ["Bengaluru", "Hyderabad", "Pune", "Gurugram", "Chennai", "Mumbai", "Noida", "Delhi"];

/** URL for the current search with one filter set (or cleared when it's already set). */
export function filterHref(params: JobSearchParams, key: Key, value: string) {
  const next: Partial<JobSearchParams> = { ...params, cursor: undefined };
  next[key] = params[key] === value ? undefined : (value as never);
  return `/jobs${toQueryString(next)}`;
}

/**
 * Filters are plain links: one tap applies them, they work without
 * JavaScript, and every result is a shareable URL.
 */
export function JobFilters({ params }: { params: JobSearchParams }) {
  const otherCities = INDIA_CITIES.filter((c) => !TOP_CITIES.includes(c));
  const cityHidden = params.city && !TOP_CITIES.includes(params.city);

  return (
    <div className="space-y-6">
      <Group label="Pay">
        <Chip href={filterHref(params, "salary", "1")} active={params.salary === "1"}>
          With salary
        </Chip>
      </Group>

      <Group label="Category">
        {Object.entries(DISCIPLINE_LABEL).map(([value, label]) => (
          <Chip key={value} href={filterHref(params, "discipline", value)} active={params.discipline === value}>
            {label}
          </Chip>
        ))}
      </Group>

      <Group label="City">
        {TOP_CITIES.map((c) => (
          <Chip key={c} href={filterHref(params, "city", c)} active={params.city === c}>
            {c}
          </Chip>
        ))}
        <details className="group w-full" open={Boolean(cityHidden)}>
          <summary className="cursor-pointer list-none py-1 text-xs text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">More cities</span>
            <span className="hidden group-open:inline">Fewer cities</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {otherCities.map((c) => (
              <Chip key={c} href={filterHref(params, "city", c)} active={params.city === c}>
                {c}
              </Chip>
            ))}
          </div>
        </details>
      </Group>

      <Group label="Work setup">
        {Object.entries(REMOTE_LABEL).map(([value, label]) => (
          <Chip key={value} href={filterHref(params, "remote", value)} active={params.remote === value}>
            {label}
          </Chip>
        ))}
      </Group>

      <Group label="Level">
        {Object.entries(LEVEL_LABEL).map(([value, label]) => (
          <Chip key={value} href={filterHref(params, "level", value)} active={params.level === value}>
            {label}
          </Chip>
        ))}
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label}>
      <h3 className="mb-2.5 text-[11px] font-medium tracking-[0.14em] text-subtle uppercase">{label}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}
