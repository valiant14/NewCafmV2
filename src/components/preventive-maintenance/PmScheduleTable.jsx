import { ChevronRight } from 'lucide-react'
import Badge from '../ui/Badge'

export default function PmScheduleTable({ rows, currentPage, pageSize, pageCount, total, onOpen, onPageChange, onPageSizeChange }) {
  const from = total ? ((currentPage - 1) * pageSize) + 1 : 0
  const to = Math.min(currentPage * pageSize, total)

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
      <div className="grid grid-cols-[1.3fr_1.1fr_.8fr_.9fr_1fr_.8fr_40px] bg-[#f8f9f6] px-4 py-3 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#858d88]">
        <span>PM plan</span><span>Asset / Location</span><span>Job plan</span><span>Schedule</span><span>Responsibility</span><span>Status</span><span />
      </div>
      {rows.map(plan => (
        <button className="grid w-full grid-cols-[1.3fr_1.1fr_.8fr_.9fr_1fr_.8fr_40px] items-center border-t border-[#eff1ed] px-4 py-4 text-left text-xs transition hover:bg-[#f8faf7]" key={plan.pmNumber} onClick={() => onOpen(plan.pmNumber)}>
          <div><strong className="block text-[var(--app-ink)]">{plan.pmNumber}</strong><span className="text-[var(--app-muted)]">{plan.description}</span></div>
          <div><strong className="block text-[var(--app-ink)]">{plan.asset || plan.location}</strong><span className="text-[var(--app-muted)]">{plan.route || plan.location || 'Asset-based PM'}</span></div>
          <div><strong className="block text-[var(--app-ink)]">{plan.jobPlan}</strong><span className="text-[var(--app-muted)]">Duration from job plan</span></div>
          <div><strong className="block text-[var(--app-ink)]">{plan.frequency} {plan.freqUnit}</strong><span className="text-[var(--app-muted)]">NEXTDATE {plan.startDate} · Lead {plan.leadTime}d</span></div>
          <div><strong className="block text-[var(--app-ink)]">{plan.personGroup || plan.department || 'Not assigned'}</strong><span className="text-[var(--app-muted)]">{plan.department} {plan.subDepartment}</span></div>
          <div><Badge tone={plan.pmStatus === 'Active' ? 'green' : 'neutral'}>{plan.pmStatus}</Badge><span className="mt-1 block text-[var(--app-muted)]">{plan.workType} · {plan.woStatus} · Counter {plan.pmCounter}</span></div>
          <ChevronRight className="text-[#7a8a80]" />
        </button>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eceee9] bg-[#fbfcfa] px-4 py-3 text-xs text-[#66746c]">
        <div>Showing <strong>{from}-{to}</strong> of <strong>{total}</strong></div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <label className="flex items-center gap-2">Rows
            <select className="h-9 rounded-lg border border-[#dfe5df] bg-white px-2" value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>
              <option value="10">10</option><option value="25">25</option><option value="50">50</option>
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-[#dfe5df] bg-white px-3 py-2 disabled:opacity-50" disabled={currentPage === 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))}>Previous</button>
            <span>Page {currentPage} of {pageCount}</span>
            <button className="rounded-lg border border-[#dfe5df] bg-white px-3 py-2 disabled:opacity-50" disabled={currentPage === pageCount} onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}>Next</button>
          </div>
        </div>
      </div>
    </section>
  )
}
