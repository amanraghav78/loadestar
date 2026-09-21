import Form from "next/form";
import Link from "next/link";
import { Label, Select } from "@/components/ui/field";
import { DISCIPLINE_LABEL, LEVEL_LABEL, REMOTE_LABEL } from "@/lib/format";
import { INDIA_CITIES } from "@/lib/ingest/classify";
import type { JobSearchParams } from "@/lib/validators";

// Minimum annual pay in LPA; stored in rupees in the URL.
const LPA_STEPS = [5, 10, 15, 20, 30, 40, 50, 75, 100];

export function JobFilters({ params }: { params: JobSearchParams }) {
  return (
    <Form action="/jobs" className="space-y-4" aria-label="Filter roles">
      {params.q && <input type="hidden" name="q" value={params.q} />}
      {params.location && <input type="hidden" name="location" value={params.location} />}
      {params.tag && <input type="hidden" name="tag" value={params.tag} />}

      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg hover:border-line-strong">
        <input
          type="checkbox"
          name="salary"
          value="1"
          defaultChecked={params.salary === "1"}
          className="size-4 accent-[#7c6cf0]"
        />
        Only roles with salary
      </label>

      <div>
        <Label htmlFor="f-city">City</Label>
        <Select id="f-city" name="city" defaultValue={params.city ?? ""}>
          <option value="">All of India</option>
          {INDIA_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="f-discipline">Discipline</Label>
        <Select id="f-discipline" name="discipline" defaultValue={params.discipline ?? ""}>
          <option value="">All disciplines</option>
          {Object.entries(DISCIPLINE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="f-level">Level</Label>
        <Select id="f-level" name="level" defaultValue={params.level ?? ""}>
          <option value="">Any level</option>
          {Object.entries(LEVEL_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="f-remote">Work setup</Label>
        <Select id="f-remote" name="remote" defaultValue={params.remote ?? ""}>
          <option value="">Any</option>
          {Object.entries(REMOTE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="f-min">Pays at least</Label>
        <Select id="f-min" name="minSalary" defaultValue={params.minSalary?.toString() ?? ""}>
          <option value="">No minimum</option>
          {LPA_STEPS.map((lpa) => (
            <option key={lpa} value={lpa * 100_000}>
              ₹{lpa} LPA
            </option>
          ))}
        </Select>
        <p className="mt-1 text-[11px] text-subtle">Only matches roles that publish pay.</p>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="metal-button h-9 flex-1 rounded-lg text-sm font-medium">
          Apply filters
        </button>
        <Link
          href="/jobs"
          className="flex h-9 shrink-0 items-center rounded-lg border border-line bg-surface px-3 text-sm text-muted hover:border-line-strong hover:text-fg"
        >
          Reset
        </Link>
      </div>
    </Form>
  );
}
