import { Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'

export default function TableSearch({ value = '', onChange, placeholder = 'Search this list', resultCount, totalCount, className }) {
  const showCount = typeof resultCount === 'number' && typeof totalCount === 'number'

  return (
    <div className={cn('app-table-toolbar', className)}>
      {showCount
        ? <span className="text-xs text-[var(--app-muted)]">Showing <strong className="text-[var(--app-ink)]">{resultCount.toLocaleString()}</strong> of {totalCount.toLocaleString()} records</span>
        : <span />}
      <label className="app-search-field">
        <Search size={15} className="pointer-events-none absolute left-3 text-[var(--app-muted)]" />
        <input
          type="search"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="app-search-input"
        />
        {value && (
          <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="app-search-clear">
            <X size={14} />
          </button>
        )}
      </label>
    </div>
  )
}
