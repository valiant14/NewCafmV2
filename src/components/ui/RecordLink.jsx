import { ArrowUpRight } from 'lucide-react'
import { cn } from '../../lib/cn'

// A pointer from one record to another - a work order on a reservation, an item on a purchase
// order. Renders as a chip rather than an underlined blue word, and inherits the accent of the
// panel it sits in, so a link belongs to its table instead of interrupting it.
//
// With no `onClick`, or with nothing to show, it degrades to plain text - a table cell should
// never advertise a link that goes nowhere.
export default function RecordLink({ value, label, onClick, icon: Icon = ArrowUpRight, title, mono = false, className }) {
  const text = label ?? value
  if (text === null || text === undefined || text === '' || text === '-') return <span className="text-[var(--app-muted)]">-</span>
  if (!onClick) return <span className={cn(mono && 'mono')}>{text}</span>

  return (
    <button
      type="button"
      className={cn('app-record-link', mono && 'mono', className)}
      onClick={onClick}
      title={title || `Open ${text}`}
    >
      <span>{text}</span>
      {Icon && <Icon size={12} />}
    </button>
  )
}
