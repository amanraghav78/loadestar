import Form from "next/form";
import Link from "next/link";
import { Label, Select, inputClass } from "@/components/ui/field";
import { DISCIPLINE_LABEL, LEVEL_LABEL, REMOTE_LABEL } from "@/lib/format";
import type { JobSearchParams } from "@/lib/validators";

const SALARY_STEPS = [40_000, 60_000, 80_000, 100_000, 120_000, 150_000, 200_000];

export function JobFilters({ params }: { params: JobSearchParams }) {
  return (
    <Form action="/jobs" className="space-y-4" aria-label="Filter roles">
      {params.q && <input type="hidden" name="q" value={params.q} />}
      {params.location && <input type="hidden" name="location" value={params.location} />}
      {params.tag && <input type="hidden" name="tag" value={params.tag} />}

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

      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
        <div>
          <Label htmlFor="f-currency">Currency</Label>
          <Select id="f-currency" name="currency" defaultValue={params.currency ?? ""}>
            <option value="">Any</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="f-min">Pays at least</Label>
          <Select id="f-min" name="minSalary" defaultValue={params.minSalary?.toString() ?? ""}>
            <option value="">No minimum</option>
            {SALARY_STEPS.map((s) => (
              <option key={s} value={s}>
                {s / 1000}k
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="h-9 flex-1 rounded-lg metal-button text-sm font-medium"
        >
          Apply filters
        </button>
        <Link href="/jobs" className={`${inputClass} flex h-9 w-auto items-center text-muted hover:text-fg`}>
          Reset
        </Link>
      </div>
    </Form>
  );
}
