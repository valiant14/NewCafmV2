import { ChevronRight } from 'lucide-react'
import Badge from '../ui/Badge'

const headers = ['WORKORDER', 'DESCRIPITION', 'LOCATION', 'LOCATION PRIORTY', 'ASSET', 'STATUS', 'WORK TYPE', 'STATUS DESCRIPITION', 'DEPARTMENT', 'SUB DEPARTMENT', 'SUB DEPARTMENT NAME', 'TARGET START', 'TARGET FINISH', 'ACTUAL START', 'ACTUAL FINISH', 'REPORTED DATE', 'PRIORTY', 'SITE', 'JOP PLAN', 'DURATION', 'PM', '']

export default function WorkOrdersTable({ rows, currentPage, pageSize, pageCount, total, onOpen, onPageChange, onPageSizeChange, orderType, excelDate, sort, onSort }) {
  const from = total ? ((currentPage - 1) * pageSize) + 1 : 0
  const to = Math.min(currentPage * pageSize, total)

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
      <div className="overflow-auto">
        <table className="w-full min-w-[1900px] border-collapse text-left text-[length:var(--app-table-font-size)]">
          <thead>
            <tr>
              {headers.map(header => (
                <th key={header || 'open'} className="whitespace-nowrap border-y border-[var(--app-line)] bg-[var(--app-table-header-bg)] px-4 py-3 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]">
                  {header ? <button className="inline-flex items-center gap-1 uppercase hover:text-[var(--app-primary)]" onClick={() => onSort?.(header)}>{header}{sort?.key === header && <span>{sort.direction === 'asc' ? '↑' : '↓'}</span>}</button> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((order, index) => (
              <tr key={index} className="cursor-pointer border-b border-[var(--app-line)] text-[var(--app-table-text)] transition hover:bg-[var(--app-table-hover-bg)]" onClick={() => onOpen(order)}>
                <td className="px-4 py-3.5 text-[var(--app-table-text)]"><strong className="mono text-[var(--app-ink)]">#{order.WORKORDER}</strong></td>
                <td className="px-4 py-3.5 text-[var(--app-table-text)]">{order['DESCRIPITION '] || '-'}</td>
                <td className="px-4 py-3.5 text-[var(--app-table-text)]">{order['LOCATION '] || '-'}</td>
                <td className="px-4 py-3.5"><Badge tone={String(order['LOCATION PRIORTY'] || '').trim() === 'VIP' ? 'purple' : 'neutral'}>{order['LOCATION PRIORTY'] || '-'}</Badge></td>
                <td className="px-4 py-3.5"><strong>{order.ASSET || '-'}</strong></td>
                <td className="px-4 py-3.5"><Badge tone="orange">{order.STATUS || '-'}</Badge></td>
                <td className="px-4 py-3.5"><Badge tone="blue">{orderType(order)}</Badge></td>
                <td className="px-4 py-3.5">{order['STATUS DESCRIPITION'] || '-'}</td>
                <td className="px-4 py-3.5">{order['DEPARTMENT '] || '-'}</td>
                <td className="px-4 py-3.5">{order['SUB DEPARTMENT '] || '-'}</td>
                <td className="px-4 py-3.5">{order['SUB DEPARTMENT  NAME'] || '-'}</td>
                <td className="px-4 py-3.5">{excelDate(order['TARGET START '])}</td>
                <td className="px-4 py-3.5">{excelDate(order['TARGET FINISH '])}</td>
                <td className="px-4 py-3.5">{excelDate(order['ACTUAL START '])}</td>
                <td className="px-4 py-3.5">{excelDate(order['ACTUAL FINISH '])}</td>
                <td className="px-4 py-3.5">{excelDate(order['REPORTED DATE '])}</td>
                <td className="px-4 py-3.5">{order.PRIORTY || '-'}</td>
                <td className="px-4 py-3.5">{order.SITE || '-'}</td>
                <td className="px-4 py-3.5">{order['JOP PLAN '] || '-'}</td>
                <td className="px-4 py-3.5">{order['DURATION '] || '-'}</td>
                <td className="px-4 py-3.5">{order['PM '] || '-'}</td>
                <td className="px-4 py-3.5"><ChevronRight size={17} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-line)] bg-[var(--app-table-footer-bg)] px-4 py-3 text-[length:var(--app-table-footer-font-size)] text-[var(--app-table-text)]">
        <div>Showing <strong>{from}-{to}</strong> of <strong>{total}</strong></div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <label className="flex items-center gap-2">Rows
            <select className="h-9 rounded-lg border border-[var(--app-line)] bg-[var(--app-table-bg)] px-2 text-[var(--app-table-text)]" value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
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
