import { useState } from 'react'
import { ChevronDown, ChevronRight, Filter, RotateCcw } from 'lucide-react'
import Combobox from './Combobox'
import { emptyStandardFilters } from '../../lib/standardFilters'

const shellClass ='mb-4 rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-3 shadow-[0_8px_24px_rgba(32,55,45,.04)]'
const gridClass = 'grid gap-3 md:grid-cols-2 xl:grid-cols-5'
const fieldClass = 'grid gap-1'
const labelClass = 'text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-muted)]'
const controlClass = 'h-10 w-full rounded-xl border border-[var(--app-field-border)] bg-[var(--app-field-bg)] px-3 text-[length:var(--app-field-font-size)] text-[var(--app-ink)] outline-none transition focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]'
const chipClass = 'inline-flex items-center rounded-full border border-[var(--app-line)] bg-[var(--app-soft-bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--app-ink)]'
const countClass = 'inline-flex items-center rounded-full bg-[var(--app-badge-blue-bg)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--app-badge-blue-text)]'

const summaryLabels = [
  ['site', 'Site'],
  ['department', 'Department'],
  ['status', 'Status'],
  ['from', 'From'],
  ['to', 'To']
]

// A searchable picker rather than a native select: these lists grow with the data, and the
// browser menu could not be filtered or styled. Typing narrows the list; only a real option
// is applied, and picking the "All ..." row (or clearing) drops the filter.
function SelectFilter({ label, value, onChange, options, placeholder }) {
  const choices = [placeholder, ...options.filter(option => String(option || '').trim() && option !== placeholder)]
  const pick = event => {
    const next = String(event.target.value || '').trim()
    if (!next) return onChange('')
    const matched = choices.find(option => option.toLowerCase() === next.toLowerCase())
    if (matched) onChange(matched === placeholder ? '' : matched)
  }

  return (
    <label className={fieldClass}>
      <span className={labelClass}>{label}</span>
      <Combobox className={controlClass} value={value} suggestions={choices} onChange={pick} placeholder={placeholder} />
    </label>
  )
}

export default function StandardFilters({
  filters,
  setFilters,
  siteOptions = [],
  departmentOptions = [],
  statusOptions = [],
  title = 'Standard Filters',
  defaultOpen = false
}) {
  // Starts collapsed on every visit. The open state used to be remembered in localStorage,
  // which meant expanding it once left the panel open on every page from then on.
  const [open, setOpen] = useState(defaultOpen)
  const update = key => value => setFilters(current => ({ ...current, [key]: value }))
  const reset = () => setFilters(emptyStandardFilters)
  const active = summaryLabels.filter(([key]) => String(filters?.[key] ?? '').trim() !== '')
  const toggle = () => setOpen(current => !current)

  return (
    <section className={shellClass}>
      <div className={`flex flex-wrap items-center gap-3 ${open ? 'mb-3' : ''}`}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex items-center gap-2 text-left text-sm font-extrabold text-[var(--app-ink)]"
        >
          <Filter size={16} className="text-[var(--app-primary)]" />
          <span>{title}</span>
          {active.length > 0 && <span className={countClass}>{active.length} active</span>}
          {open ? <ChevronDown size={13} className="text-[var(--app-muted)]" /> : <ChevronRight size={13} className="text-[var(--app-muted)]" />}
        </button>

        {!open && active.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {active.map(([key, label]) => <span className={chipClass} key={key}>{label}: {filters[key]}</span>)}
          </div>
        )}

        <button
          type="button"
          className="ml-auto inline-flex h-8 items-center gap-2 rounded-lg px-2 text-xs font-bold text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={reset}
          disabled={active.length === 0}
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      {open && (
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
      )}
    </section>
  )
}
