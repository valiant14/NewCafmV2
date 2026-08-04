import { ChevronRight } from 'lucide-react'
import Badge from '../ui/Badge'
import TablePanel from '../ui/TablePanel'
import { statusDescription, statusTone } from '../../lib/statusMatrix'
import { isOnHold } from '../../lib/holdPeriods'

const cellClass = 'px-4 py-3.5 align-middle text-[var(--app-table-text)]'
const compactClass = `${cellClass} whitespace-nowrap`
const textValue = value => String(value ?? '').trim() || '-'

const columns = [
  { key: 'WORKORDER', label: 'Work Order', sortKey: 'WORKORDER', className: compactClass, render: order => <strong className="mono text-[var(--app-ink)]">#{order.WORKORDER}</strong> },
  { key: 'description', label: 'Description', sortKey: 'DESCRIPITION', className: cellClass, render: order => textValue(order['DESCRIPITION ']) },
  { key: 'location', label: 'Location', sortKey: 'LOCATION', className: cellClass, render: order => textValue(order['LOCATION ']) },
  { key: 'asset', label: 'Asset', sortKey: 'ASSET', className: compactClass, render: order => <strong>{textValue(order.ASSET)}</strong> },
  { key: 'status', label: 'Status', sortKey: 'STATUS', className: compactClass, render: order => <Badge tone={statusTone(order.STATUS)}>{order.STATUS} · {statusDescription('workOrder', order.STATUS) || textValue(order.STATUS)}</Badge> },
  { key: 'type', label: 'Type', sortKey: 'WORK TYPE', className: compactClass, render: (order, { orderType }) => <Badge tone="blue">{orderType(order)}</Badge> },
  { key: 'department', label: 'Department', sortKey: 'DEPARTMENT', className: compactClass, render: order => textValue(order['DEPARTMENT ']) },
  { key: 'assignedDepartment', label: 'Assigned Department', sortKey: 'ASSIGNED DEPARTMENT', className: compactClass, render: order => textValue(order['ASSIGNED DEPARTMENT']) },
  { key: 'subDepartment', label: 'Sub Department', sortKey: 'SUB DEPARTMENT NAME', className: compactClass, render: order => textValue(order['SUB DEPARTMENT  NAME']) },
  { key: 'targetStart', label: 'Target Start', sortKey: 'TARGET START', className: compactClass, render: (order, { excelDate }) => excelDate(order['TARGET START ']) },
  { key: 'targetFinish', label: 'Target Finish', sortKey: 'TARGET FINISH', className: compactClass, render: (order, { excelDate }) => isOnHold(order) ? <Badge tone="orange">SLA Paused</Badge> : excelDate(order['TARGET FINISH ']) },
  { key: 'actualStart', label: 'Actual Start', sortKey: 'ACTUAL START', className: compactClass, render: (order, { excelDate }) => excelDate(order['ACTUAL START ']) },
  { key: 'actualFinish', label: 'Actual Finish', sortKey: 'ACTUAL FINISH', className: compactClass, render: (order, { excelDate }) => excelDate(order['ACTUAL FINISH ']) },
  { key: 'reportedDate', label: 'Reported Date', sortKey: 'REPORTED DATE', className: compactClass, render: (order, { excelDate }) => excelDate(order['REPORTED DATE ']) },
  { key: 'priority', label: 'Priority', sortKey: 'PRIORTY', className: compactClass, render: order => textValue(order.PRIORTY) },
  { key: 'site', label: 'Site', sortKey: 'SITE', className: compactClass, render: order => textValue(order.SITE) },
  { key: 'sourceSr', label: 'Source SR', sortKey: 'SOURCE SR', className: compactClass, render: order => textValue(order['SOURCE SR']) },
  { key: 'open', label: '', className: compactClass, render: () => <ChevronRight size={17} /> }
]

export default function WorkOrdersTable({ rows, currentPage, pageSize, pageCount, total, onOpen, onPageChange, onPageSizeChange, orderType, excelDate, sort, onSort }) {
  const from = total ? ((currentPage - 1) * pageSize) + 1 : 0
  const to = Math.min(currentPage * pageSize, total)
  const context = { orderType, excelDate }

  return (
    <TablePanel>
      <div className="overflow-auto">
        <table className="data-table work-orders-table w-full min-w-[1650px] border-collapse text-left text-[length:var(--app-table-font-size)]">
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
