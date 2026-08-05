import { useState } from 'react'
import { CheckCircle2, PackageCheck, Play, XCircle } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import TablePanel from '../components/ui/TablePanel'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { nowLocalDate } from '../lib/datetime'
import useModuleAccess from '../hooks/useModuleAccess'

const todayStamp = () => nowLocalDate()
const purchaseOrderStatuses = ['WAPPR', 'APPR', 'INPRG', 'CLOSE', 'CAN']

export default function PurchaseOrdersPage({
  rows = [],
  onUpdateOrder,
  onUpdateRequest
}) {
  const access = useModuleAccess('Purchase Orders')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [status, setStatus] = useState('All')
  const statusRows = status === 'All' ? rows : rows.filter(row => row.status === status)
  const visibleRows = applyStandardFilters(statusRows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdAt']
  })

  const cancelOrder = row => onUpdateOrder?.(row.purchaseOrder, { status: 'CAN', cancelledAt: todayStamp() })
  const updateOrderStatus = (row, nextStatus) => {
    const datePatch = {
      APPR: { approvedAt: todayStamp() },
      INPRG: {},
      CLOSE: { receivedAt: todayStamp(), closedAt: todayStamp() }
    }[nextStatus] || {}
    onUpdateOrder?.(row.purchaseOrder, { status: nextStatus, ...datePatch })
    if (nextStatus === 'CLOSE') onUpdateRequest?.(row.purchaseRequest, { status: 'CLOSE', closedAt: todayStamp() })
  }

  const rowAction = row => {
    if (row.status === 'WAPPR') {
      if (!access.edit) return '-'
      return (
        <div className="flex flex-wrap gap-2">
          {access.edit && access.approve && <Button className="h-8 px-3 text-xs" onClick={() => updateOrderStatus(row, 'APPR')}><CheckCircle2 size={14} />Approve PO</Button>}
          {access.edit && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelOrder(row)}><XCircle size={14} />Cancel</Button>}
        </div>
      )
    }
    if (row.status === 'APPR') {
      if (!access.edit) return '-'
      return (
        <div className="flex flex-wrap gap-2">
          <Button className="h-8 px-3 text-xs" onClick={() => updateOrderStatus(row, 'INPRG')}><Play size={14} />Start processing</Button>
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelOrder(row)}><XCircle size={14} />Cancel</Button>
        </div>
      )
    }
    if (row.status === 'INPRG') {
      if (!access.edit) return '-'
      return (
        <div className="flex flex-wrap gap-2">
          {access.edit && access.close && <Button className="h-8 px-3 text-xs" onClick={() => updateOrderStatus(row, 'CLOSE')}><PackageCheck size={14} />Receive & close</Button>}
          {access.edit && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelOrder(row)}><XCircle size={14} />Cancel</Button>}
        </div>
      )
    }
    if (row.status === 'CLOSE') return <Badge tone="green">Closed</Badge>
    if (row.status === 'CAN') return <Badge tone="orange">Cancelled</Badge>
    return '-'
  }

  return (
    <section>
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Purchase Orders"
        description="Approved procurement orders linked to Purchase Requisitions and Work Orders."
      />
      <IndexTabs
        active={status}
        onChange={setStatus}
        tabs={[
          { key: 'All', label: 'All POs', count: rows.length },
          ...purchaseOrderStatuses.map(item => ({
            key: item,
            label: item,
            count: rows.filter(row => row.status === item).length
          }))
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={purchaseOrderStatuses}
      />
      <TablePanel>
        {visibleRows.length ? (
          <DataTable
            rows={visibleRows}
            rowKey="purchaseOrder"
            pagination
            columns={[
              { key: 'purchaseOrder', label: 'PO Number', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
              { key: 'purchaseRequest', label: 'Source PR' },
              { key: 'workOrder', label: 'Work Order' },
              { key: 'item', label: 'Item / Description' },
              { key: 'quantity', label: 'Quantity' },
              { key: 'source', label: 'Supplier / Store' },
              { key: 'site', label: 'Site' },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status', render: value => <StatusBadge application="purchaseOrder" value={value} /> },
              { key: 'createdAt', label: 'Created' },
              { key: 'action', label: 'Next Step', sortable: false, render: (_, row) => rowAction(row) }
            ]}
          />
        ) : (
          <EmptyState
            icon={PackageCheck}
            title="No purchase orders yet"
            description="Approve a purchase requisition to create the linked purchase order record."
          />
        )}
      </TablePanel>
    </section>
  )
}
