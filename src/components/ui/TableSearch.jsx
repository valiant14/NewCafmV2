import { Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'

export default function TableSearch({ value = '', onChange, placeholder = 'Search this list', resultCount, totalCount, className }) {
  const showCount = typeof resultCount === 'number' && typeof totalCount === 'number'

  return (
    <div className={cn('mb-3 flex flex-wrap items-center justify-between gap-3', className)}>
      {showCount
        ? <span className="text-xs text-[var(--app-muted)]">Showing <strong className="text-[var(--app-ink)]">{resultCount.toLocaleString()}</strong> of {totalCount.toLocaleString()} records</span>
        : <span />}
      <label className="relative ml-auto flex w-full max-w-xs items-center">
        <Search size={15} className="pointer-events-none absolute left-3 text-[var(--app-muted)]" />
        <input
          type="search"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-10 w-full rounded-xl border border-[var(--app-field-border)] bg-[var(--app-field-bg)] pl-9 pr-9 text-sm text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--app-primary)]"
        />
        {value && (
          <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 grid h-6 w-6 place-items-center rounded-lg text-[var(--app-muted)] transition hover:bg-[var(--app-soft-bg-hover)] hover:text-[var(--app-ink)]">
            <X size={14} />
          </button>
        )}
      </label>
    </div>
  )
}
