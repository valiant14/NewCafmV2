import { Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'

// The list search. It no longer reports "showing n of m" - the index tab badges and the table
// footer already say how many rows there are, and repeating it three times added a whole row of
// chrome above every table. Placement is the caller's business: IndexTabs lays it out beside the
// tabs, which is how every list page uses it.
export default function TableSearch({ value = '', onChange, placeholder = 'Search this list', className }) {
  return (
    <label className={cn('app-search-field', className)}>
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
  )
}
