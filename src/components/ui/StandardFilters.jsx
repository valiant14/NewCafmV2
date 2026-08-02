import { Filter, RotateCcw } from 'lucide-react'
import { emptyStandardFilters } from '../../lib/standardFilters'

const shellClass = 'mb-4 rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-3 shadow-[0_8px_24px_rgba(32,55,45,.04)]'
const gridClass = 'grid gap-3 md:grid-cols-2 xl:grid-cols-5'
const fieldClass = 'grid gap-1'
const labelClass = 'text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]'
const controlClass = 'h-10 rounded-xl border border-[var(--app-field-border)] bg-[var(--app-field-bg)] px-3 text-[length:var(--app-field-font-size)] text-[var(--app-ink)] outline-none transition focus:border-[var(--app-primary)]'

function SelectFilter({ label, value, onChange, options, placeholder }) {
  return (
    <label className={fieldClass}>
      <span className={labelClass}>{label}</span>
      <select className={controlClass} value={value} onChange={event => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

export default function StandardFilters({
  filters,
  setFilters,
  siteOptions = [],
  departmentOptions = [],
  statusOptions = [],
  title = 'Standard Filters'
}) {
  const update = key => value => setFilters(current => ({ ...current, [key]: value }))
  const reset = () => setFilters(emptyStandardFilters)

  return (
    <section className={shellClass}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--app-ink)]">
          <Filter size={16} className="text-[var(--app-primary)]" />
          {title}
        </div>
        <button type="button" className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)]" onClick={reset}>
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      <div className={gridClass}>
        <SelectFilter label="Site" value={filters.site} onChange={update('site')} options={siteOptions} placeholder="All sites" />
        <SelectFilter label="Department" value={filters.department} onChange={update('department')} options={departmentOptions} placeholder="All departments" />
        <SelectFilter label="Status" value={filters.status} onChange={update('status')} options={statusOptions} placeholder="All statuses" />
        <label className={fieldClass}>
          <span className={labelClass}>Date From</span>
          <input className={controlClass} type="date" value={filters.from} onChange={event => update('from')(event.target.value)} />
        </label>
        <label className={fieldClass}>
          <span className={labelClass}>Date To</span>
          <input className={controlClass} type="date" value={filters.to} onChange={event => update('to')(event.target.value)} />
        </label>
      </div>
    </section>
  )
}
