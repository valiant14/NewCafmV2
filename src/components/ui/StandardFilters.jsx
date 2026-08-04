import { useState } from 'react'
import { ChevronDown, ChevronRight, Filter, RotateCcw } from 'lucide-react'
import Combobox from './Combobox'
import { emptyStandardFilters } from '../../lib/standardFilters'

const shellClass = 'app-filter-panel'
const gridClass = 'app-filter-grid'
const fieldClass = 'app-filter-field'
const labelClass = 'app-field-label'
const controlClass = 'app-field-control'
const chipClass = 'app-filter-chip'
const countClass = 'app-filter-count'

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
      <div className={`app-filter-summary ${open ? 'app-filter-summary--open' : ''}`}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="app-filter-toggle"
        >
          <Filter size={16} className="text-[var(--app-primary)]" />
          <span>{title}</span>
          {active.length > 0 && <span className={countClass}>{active.length} active</span>}
          {open ? <ChevronDown size={13} className="text-[var(--app-muted)]" /> : <ChevronRight size={13} className="text-[var(--app-muted)]" />}
        </button>

        {!open && active.length > 0 && (
          <div className="app-filter-chips">
            {active.map(([key, label]) => <span className={chipClass} key={key}>{label}: {filters[key]}</span>)}
          </div>
        )}

        <button
          type="button"
          className="app-filter-reset"
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
