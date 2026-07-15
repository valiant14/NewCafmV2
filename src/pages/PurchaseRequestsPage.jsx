import { useState } from 'react'
import { CheckCircle2, PackageCheck, Play, ShoppingCart, XCircle } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { statusDescription, statusTone } from '../lib/statusMatrix'

const todayStamp = () => new Date().toISOString().slice(0, 10)

export default function PurchaseRequestsPage({
  rows = [],
  purchaseOrders = [],
  onApproveRequest,
  onUpdateRequest,
  onUpdateOrder
}) {
  const [filters, setFilters] = useState(emptyStandardFilters)
  const visibleRows = applyStandardFilters(rows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdAt']
  })
  const visibleOrders = applyStandardFilters(purchaseOrders, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdAt']
  })

  const approveRequest = row => onApproveRequest?.(row)
  const closeRequest = row => onUpdateRequest?.(row.purchaseRequest, { status: 'CLOSE', closedAt: todayStamp() })
  const cancelRequest = row => onUpdateRequest?.(row.purchaseRequest, { status: 'CAN', cancelledAt: todayStamp() })
  const updateOrderStatus = (row, status) => {
    onUpdateOrder?.(row.purchaseOrder, { status, [`${status.toLowerCase()}At`]: todayStamp() })
    if (status === 'CLOSE') onUpdateRequest?.(row.purchaseRequest, { status: 'CLOSE', closedAt: todayStamp() })
  }

  const requestAction = row => {
    if (row.status === 'WAPPR') {
      return (
        <div className="flex flex-wrap gap-2">
          <Button className="h-8 px-3 text-xs" onClick={() => approveRequest(row)}><CheckCircle2 size={14} />Approve & create PO</Button>
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelRequest(row)}><XCircle size={14} />Cancel</Button>
        </div>
      )
    }
    if (row.status === 'APPR') return <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => closeRequest(row)}><CheckCircle2 size={14} />Close PR</Button>
    if (row.status === 'CLOSE') return <Badge tone="green">Closed</Badge>
    if (row.status === 'CAN') return <Badge tone="orange">Cancelled</Badge>
    return '-'
  }

  const orderAction = row => {
    if (row.status === 'WAPPR') return <Button className="h-8 px-3 text-xs" onClick={() => updateOrderStatus(row, 'APPR')}><CheckCircle2 size={14} />Approve PO</Button>
    if (row.status === 'APPR') return <Button className="h-8 px-3 text-xs" onClick={() => updateOrderStatus(row, 'INPRG')}><Play size={14} />Start processing</Button>
    if (row.status === 'INPRG') return <Button className="h-8 px-3 text-xs" onClick={() => updateOrderStatus(row, 'CLOSE')}><PackageCheck size={14} />Receive & close</Button>
    if (row.status === 'CLOSE') return <Badge tone="green">Closed</Badge>
    if (row.status === 'CAN') return <Badge tone="orange">Cancelled</Badge>
    return '-'
  }

  return (
    <section>
      <PageHeader
        eyebrow="PROCUREMENT"
        title="Purchase Requests"
        description="Purchase requests created from Work Order material shortages, then approved into linked purchase orders."
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows([...rows, ...purchaseOrders], ['site'])}
        departmentOptions={optionsFromRows([...rows, ...purchaseOrders], ['department'])}
        statusOptions={optionsFromRows([...rows, ...purchaseOrders], ['status'])}
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
              { key: 'source', label: 'Source' },
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
            title="No purchase requests yet"
            description="When a Work Order resource is not available, click Create purchase request in Material Requests."
          />
        )}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <header className="border-b border-[var(--app-line)] px-4 py-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">PURCHASE ORDER LIFECYCLE</p>
          <h2 className="text-base font-extrabold text-[var(--app-ink)]">Purchase Orders created from approved PRs</h2>
        </header>
        {visibleOrders.length ? (
          <DataTable
            rows={visibleOrders}
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
              { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value} · {statusDescription('purchaseOrder', value)}</Badge> },
              { key: 'createdAt', label: 'Created' },
              { key: 'action', label: 'Next Step', sortable: false, render: (_, row) => orderAction(row) }
            ]}
          />
        ) : (
          <EmptyState
            icon={PackageCheck}
            title="No purchase orders yet"
            description="Approve a purchase request to create the linked purchase order record."
          />
        )}
      </section>
    </section>
  )
}
