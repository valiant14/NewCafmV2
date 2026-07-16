import { useState } from 'react'
import { CheckCircle2, ShoppingCart, XCircle } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { statusDescription, statusTone } from '../lib/statusMatrix'

const todayStamp = () => new Date().toISOString().slice(0, 10)
const purchaseRequisitionStatuses = ['WAPPR', 'APPR', 'CLOSE', 'CAN']

export default function PurchaseRequestsPage({
  rows = [],
  onApproveRequest,
  onUpdateRequest
}) {
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [requestStatus, setRequestStatus] = useState('All')

  const requestRows = requestStatus === 'All' ? rows : rows.filter(row => row.status === requestStatus)

  const visibleRows = applyStandardFilters(requestRows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdAt']
  })

  const approveRequest = row => onApproveRequest?.(row)
  const closeRequest = row => onUpdateRequest?.(row.purchaseRequest, { status: 'CLOSE', closedAt: todayStamp() })
  const cancelRequest = row => onUpdateRequest?.(row.purchaseRequest, { status: 'CAN', cancelledAt: todayStamp() })

  const requestAction = row => {
    if (row.status === 'WAPPR') {
      return (
        <div className="flex flex-wrap gap-2">
          <Button className="h-8 px-3 text-xs" onClick={() => approveRequest(row)}><CheckCircle2 size={14} />Approve & create PO</Button>
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelRequest(row)}><XCircle size={14} />Cancel</Button>
        </div>
      )
    }
    if (row.status === 'APPR') {
      return (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => closeRequest(row)}><CheckCircle2 size={14} />Close PR</Button>
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelRequest(row)}><XCircle size={14} />Cancel</Button>
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
        title="Purchase Requisitions"
        description="Requests for unavailable materials or tools before a Purchase Order is created."
      />
      <IndexTabs
        active={requestStatus}
        onChange={setRequestStatus}
        tabs={[
          { key: 'All', label: 'All PRs', count: rows.length },
          ...purchaseRequisitionStatuses.map(status => ({
            key: status,
            label: status,
            count: rows.filter(row => row.status === status).length
          }))
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={purchaseRequisitionStatuses}
      />
      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        {visibleRows.length ? (
          <DataTable
            rows={visibleRows}
            rowKey="purchaseRequest"
            pagination
            columns={[
              { key: 'purchaseRequest', label: 'PR Number', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
              { key: 'workOrder', label: 'Work Order' },
              { key: 'item', label: 'Item / Description' },
              { key: 'quantity', label: 'Quantity' },
              { key: 'source', label: 'Requested From' },
              { key: 'purchaseOrder', label: 'Linked PO', render: value => value || 'Not created' },
              { key: 'site', label: 'Site' },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value} · {statusDescription('purchaseRequisition', value)}</Badge> },
              { key: 'createdAt', label: 'Created' },
              { key: 'action', label: 'Next Step', sortable: false, render: (_, row) => requestAction(row) }
            ]}
          />
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="No purchase requisitions yet"
            description="When a Work Order resource is not available, click Create purchase request in Material Requests."
          />
        )}
      </section>
    </section>
  )
}
