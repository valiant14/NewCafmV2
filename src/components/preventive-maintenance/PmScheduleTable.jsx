import { ChevronRight } from 'lucide-react'
import Badge from '../ui/Badge'
import { statusDescription, statusTone } from '../../lib/statusMatrix'
import { pmDueLabel, pmDueTone } from '../../lib/pmSchedule'

const columns = [
  { key: 'pmNumber', label: 'PM plan' },
  { key: 'asset', label: 'Asset / Location' },
  { key: 'jobPlan', label: 'Job plan' },
  { key: 'frequency', label: 'Schedule' },
  { key: 'department', label: 'Responsibility' },
  { key: 'pmStatus', label: 'Status' },
  { key: '', label: '' }
]

export default function PmScheduleTable({ rows, currentPage, pageSize, pageCount, total, onOpen, onPageChange, onPageSizeChange, sort, onSort }) {
  const from = total ? ((currentPage - 1) * pageSize) + 1 : 0
  const to = Math.min(currentPage * pageSize, total)

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
      <div className="grid grid-cols-[1.3fr_1.1fr_.8fr_.9fr_1fr_.8fr_40px] bg-[var(--app-table-header-bg)] px-4 py-3 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]">
        {columns.map(column => <span key={column.key || 'open'}>{column.label && <button className="inline-flex items-center gap-1 uppercase hover:text-[var(--app-primary)]" onClick={() => onSort?.(column.key)}>{column.label}{sort?.key === column.key && <span>{sort.direction === 'asc' ? '↑' : '↓'}</span>}</button>}</span>)}
      </div>
      {rows.map(plan => (
        <button className="grid w-full grid-cols-[1.3fr_1.1fr_.8fr_.9fr_1fr_.8fr_40px] items-center border-t border-[var(--app-line)] px-4 py-4 text-left text-[length:var(--app-table-font-size)] text-[var(--app-table-text)] transition hover:bg-[var(--app-table-hover-bg)]" key={plan.pmNumber} onClick={() => onOpen(plan.pmNumber)}>
          <div><strong className="block text-[var(--app-ink)]">{plan.pmNumber}</strong><span className="text-[var(--app-muted)]">{plan.description}</span></div>
          <div><strong className="block text-[var(--app-ink)]">{plan.asset || plan.location}</strong><span className="text-[var(--app-muted)]">{plan.route || plan.location || 'Asset-based PM'}</span></div>
          <div><strong className="block text-[var(--app-ink)]">{plan.jobPlan}</strong><span className="text-[var(--app-muted)]">Duration from job plan</span></div>
          <div><strong className="block text-[var(--app-ink)]">{plan.frequency} {plan.freqUnit}</strong><span className="text-[var(--app-muted)]">NEXTDATE {plan.startDate} · Lead {plan.leadTime}d</span></div>
          <div><strong className="block text-[var(--app-ink)]">{plan.personGroup || plan.department || 'Not assigned'}</strong><span className="text-[var(--app-muted)]">{plan.department} {plan.subDepartment}</span></div>
          <div><Badge tone={statusTone(plan.pmStatus)}>{plan.pmStatus} · {statusDescription('preventiveMaintenance', plan.pmStatus)}</Badge><span className="mt-1 block"><Badge tone={pmDueTone(plan)}>{pmDueLabel(plan)}</Badge></span><span className="mt-1 block text-[var(--app-muted)]">{plan.workType} · {plan.woStatus} · Counter {plan.pmCounter}</span></div>
          <ChevronRight className="text-[var(--app-muted)]" />
        </button>
      ))}
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
    </section>
  )
}
