import { ChevronRight } from 'lucide-react'
import Badge from '../ui/Badge'
import PriorityBadge from '../ui/PriorityBadge'
import StatusBadge from '../ui/StatusBadge'
import TablePanel from '../ui/TablePanel'
import { isOnHold } from '../../lib/holdPeriods'
import { workflowStatusLabel, workflowStepByStatus } from '../../lib/workOrderWorkflow'

const cellClass = 'px-4 py-3.5 align-middle text-[var(--app-table-text)]'
const compactClass = `${cellClass} whitespace-nowrap`
const textValue = value => String(value ?? '').trim() || '-'
// Two dates stacked in one cell need saying which is which, so each carries a bold label.
const datePart = (label, value) => value
  ? <><strong className="app-cell-label">{label}:</strong> {value}</>
  : null

// Eighteen single-value columns forced a 1650px sideways scroll and let the location code
// wrap over four lines. Related values now share a cell as a primary line with a muted
// secondary line - the same two-line pattern the Users and Incidents tables use - so the
// list fits on screen. Every dropped column is still in the Excel export and the detail page.
const columns = [
  { key: 'WORKORDER', label: 'Work Order', sortKey: 'WORKORDER', className: cellClass, render: order => (
    <div className="app-cell-stack">
      <strong className="mono text-[var(--app-ink)]">#{order.WORKORDER}</strong>
      <span className="app-cell-note">{textValue(order['DESCRIPITION '])}</span>
    </div>
  ) },
  { key: 'location', label: 'Location / Asset', sortKey: 'LOCATION', className: compactClass, render: order => (
    <div className="app-cell-stack">
      <span className="mono">{textValue(order['LOCATION '])}</span>
      <span className="app-cell-note">{textValue(order.ASSET)}</span>
    </div>
  ) },
  { key: 'status', label: 'Status', sortKey: 'STATUS', className: compactClass, render: (order, { workflow }) => {
    const step = workflowStepByStatus(workflow, order.STATUS)
    return <StatusBadge application="workOrder" value={order.STATUS} description={workflowStatusLabel(workflow, order.STATUS)} tone={step?.badgeTone} />
  } },
  { key: 'type', label: 'Type', sortKey: 'WORK TYPE', className: compactClass, render: (order, { orderType }) => <Badge tone="blue">{orderType(order)}</Badge> },
  { key: 'priority', label: 'Priority', sortKey: 'PRIORTY', className: compactClass, render: order => <PriorityBadge value={order.PRIORTY} /> },
  { key: 'department', label: 'Department', sortKey: 'DEPARTMENT', className: compactClass, render: order => {
    const department = textValue(order['DEPARTMENT '])
    const assigned = textValue(order['ASSIGNED DEPARTMENT'])
    const sub = String(order['SUB DEPARTMENT  NAME'] ?? '').trim()
    return (
      <div className="app-cell-stack">
        <span>{department}{assigned !== '-' && assigned !== department ? ` → ${assigned}` : ''}</span>
        <span className="app-cell-note">{sub || ' '}</span>
      </div>
    )
  } },
  { key: 'site', label: 'Site', sortKey: 'SITE', className: compactClass, render: order => textValue(order.SITE) },
  { key: 'target', label: 'Target', sortKey: 'TARGET FINISH', className: compactClass, render: (order, { excelDate }) => (
    <div className="app-cell-stack">
      {isOnHold(order) ? <Badge tone="orange">SLA Paused</Badge> : <span>{datePart('Finish', excelDate(order['TARGET FINISH '])) || '-'}</span>}
      <span className="app-cell-note">{datePart('Start', excelDate(order['TARGET START '])) || ' '}</span>
    </div>
  ) },
  { key: 'actual', label: 'Actual', sortKey: 'ACTUAL FINISH', className: compactClass, render: (order, { excelDate }) => (
    <div className="app-cell-stack">
      <span>{datePart('Finish', excelDate(order['ACTUAL FINISH '])) || '-'}</span>
      <span className="app-cell-note">{datePart('Start', excelDate(order['ACTUAL START '])) || ' '}</span>
    </div>
  ) },
  { key: 'open', label: '', className: compactClass, render: () => <ChevronRight size={17} /> }
]

export default function WorkOrdersTable({ rows, currentPage, pageSize, pageCount, total, onOpen, onPageChange, onPageSizeChange, orderType, excelDate, workflow, sort, onSort }) {
  const from = total ? ((currentPage - 1) * pageSize) + 1 : 0
  const to = Math.min(currentPage * pageSize, total)
  const context = { orderType, excelDate, workflow }

  return (
    <TablePanel>
      <div className="overflow-auto">
        <table className="data-table work-orders-table w-full min-w-[1080px] border-collapse text-left text-[length:var(--app-table-font-size)]">
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.key} className="whitespace-nowrap border-y border-[var(--app-line)] bg-[var(--app-table-header-bg)] px-4 py-3 text-[length:var(--app-table-header-font-size)] font-extrabold uppercase tracking-[.08em] text-[var(--app-table-heading)]">
                  {column.sortKey ? (
                    <button className="inline-flex items-center gap-1 uppercase hover:text-[var(--app-primary)]" onClick={() => onSort?.(column.sortKey)}>
                      {column.label}
                      {sort?.key === column.sortKey && <span>{sort.direction === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  ) : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(order => (
              <tr key={order.WORKORDER} className="cursor-pointer border-b border-[var(--app-line)] text-[var(--app-table-text)] transition hover:bg-[var(--app-table-hover-bg)]" onClick={() => onOpen(order)}>
                {columns.map(column => (
                  <td key={column.key} data-label={column.label || ''} className={column.className}>{column.render(order, context)}</td>
                ))}
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
    </TablePanel>
  )
}
