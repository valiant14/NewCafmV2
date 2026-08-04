import { ArrowDown, ArrowUp, CalendarClock, ChevronRight, Repeat } from 'lucide-react'
import Badge from '../ui/Badge'
import TablePanel from '../ui/TablePanel'
import { statusDescription, statusTone } from '../../lib/statusMatrix'
import { pmDueLabel, pmDueTone } from '../../lib/pmSchedule'
import { scheduleForPlan } from '../../lib/pmGeneration'
import { parseLocal } from '../../lib/datetime'

const columns = [
  { key: 'pmNumber', label: 'PM plan' },
  { key: 'asset', label: 'Asset' },
  { key: 'jobPlan', label: 'Job plan' },
  { key: 'frequency', label: 'Rule / Schedule' },
  { key: 'startDate', label: 'Next run' },
  { key: 'department', label: 'Responsibility' },
  { key: 'pmStatus', label: 'Status' },
  { key: '', label: '' }
]

const formatNextRun = value => {
  const date = parseLocal(value)
  if (!date) return '-'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const sortIcon = (sort, key) => {
  if (sort?.key !== key) return null
  return sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
}

export default function PmScheduleTable({ rows, currentPage, pageSize, pageCount, total, onOpen, onPageChange, onPageSizeChange, sort, onSort, pmRules = [] }) {
  const from = total ? ((currentPage - 1) * pageSize) + 1 : 0
  const to = Math.min(currentPage * pageSize, total)

  return (
    <TablePanel>
      <div className="pm-schedule-table-header grid grid-cols-[1.15fr_1fr_.8fr_1.1fr_1fr_.95fr_.95fr_28px] bg-[var(--app-table-header-bg)] px-4 py-3 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]">
        {columns.map(column => <span key={column.key || 'open'}>{column.label && <button className="inline-flex items-center gap-1 uppercase hover:text-[var(--app-primary)]" onClick={() => onSort?.(column.key)}>{column.label}{sortIcon(sort, column.key)}</button>}</span>)}
      </div>
      {rows.map(plan => {
        const schedule = scheduleForPlan(plan, pmRules)
        return (
          <button className="pm-schedule-table-row grid w-full grid-cols-[1.15fr_1fr_.8fr_1.1fr_1fr_.95fr_.95fr_28px] items-center gap-3 border-t border-[var(--app-line)] px-4 py-3 text-left text-[length:var(--app-table-font-size)] text-[var(--app-table-text)] transition hover:bg-[var(--app-table-hover-bg)]" key={plan.pmNumber} onClick={() => onOpen(plan.pmNumber)}>
            <div className="min-w-0"><strong className="mono block truncate text-sm text-[var(--app-ink)]">{plan.pmNumber}</strong><span className="mt-1 block truncate text-[var(--app-muted)]">{plan.description || '-'}</span></div>
            <div className="min-w-0"><strong className="block truncate text-[var(--app-ink)]">{plan.asset || plan.location}</strong><span className="block truncate text-[var(--app-muted)]">{plan.route || plan.location || 'Asset-based PM'}</span></div>
            <div className="min-w-0"><strong className="block truncate text-[var(--app-ink)]">{plan.jobPlan}</strong><span className="block truncate text-[var(--app-muted)]">Job plan</span></div>
            <div>
              <Badge tone="blue"><Repeat size={12} />Every {schedule.frequency} {schedule.freqUnit}</Badge>
              <span className="mt-1 block truncate text-[var(--app-muted)]">{plan.scheduleRule || 'Direct PM schedule'}</span>
            </div>
            <div>
              <strong className="flex items-center gap-2 text-[var(--app-ink)]"><CalendarClock size={14} />{formatNextRun(plan.startDate)}</strong>
              <span className="block text-[var(--app-muted)]">Lead {schedule.leadTime}d - Trigger {String(schedule.triggerHour || 0).padStart(2, '0')}:00</span>
            </div>
            <div className="min-w-0"><strong className="block truncate text-[var(--app-ink)]">{plan.personGroup || plan.department || 'Not assigned'}</strong><span className="block truncate text-[var(--app-muted)]">{plan.department} {plan.subDepartment}</span></div>
            <div><div className="flex flex-wrap gap-1"><Badge tone={statusTone(plan.pmStatus)}>{plan.pmStatus}</Badge><Badge tone={pmDueTone(plan, pmRules)}>{pmDueLabel(plan, pmRules)}</Badge></div><span className="mt-1 block text-[var(--app-muted)]">{plan.workType} - {schedule.woStatus} - Counter {plan.pmCounter}</span></div>
            <ChevronRight className="text-[var(--app-muted)]" />
          </button>
        )
      })}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-line)] bg-[var(--app-table-footer-bg)] px-4 py-3 text-[length:var(--app-table-footer-font-size)] text-[var(--app-table-text)]">
        <div>Showing <strong>{from}-{to}</strong> of <strong>{total}</strong></div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <label className="flex items-center gap-2">Rows
            <select className="h-9 rounded-lg border border-[var(--app-line)] bg-[var(--app-table-bg)] px-2 text-[var(--app-table-text)]" value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>
              <option value="10">10</option><option value="25">25</option><option value="50">50</option>
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-[var(--app-line)] bg-[var(--app-table-bg)] px-3 py-2 text-[var(--app-table-text)] disabled:opacity-50" disabled={currentPage === 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))}>Previous</button>
            <span>Page {currentPage} of {pageCount}</span>
            <button className="rounded-lg border border-[var(--app-line)] bg-[var(--app-table-bg)] px-3 py-2 text-[var(--app-table-text)] disabled:opacity-50" disabled={currentPage === pageCount} onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}>Next</button>
          </div>
        </div>
      </div>
    </TablePanel>
  )
}
