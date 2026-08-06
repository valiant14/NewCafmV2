import { useState } from 'react'
import { CheckCircle2, Package, PackageCheck, Play, XCircle } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import TablePanel from '../components/ui/TablePanel'
import RecordLink from '../components/ui/RecordLink'
import RecordFilterNotice from '../components/ui/RecordFilterNotice'
import { matchesReference, openInventoryItem, useRecordFilter } from '../lib/recordNavigation'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { nowLocalDate } from '../lib/datetime'
import useModuleAccess from '../hooks/useModuleAccess'
import { applicationWorkflowStep, supplyChainMilestone } from '../lib/applicationWorkflow'

const todayStamp = () => nowLocalDate()
const purchaseOrderStatuses = ['WAPPR', 'APPR', 'INPRG', 'CLOSE', 'CAN']

export default function PurchaseOrdersPage({
  rows = [],
<<<<<<< HEAD
  onOpenWorkOrder,
=======
  workflow,
>>>>>>> d2e7bff1e758d984014269be7f9c08eefae2b024
  onUpdateOrder
}) {
  const access = useModuleAccess('Purchase Orders')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [status, setStatus] = useState('All')
  const statusRows = status === 'All' ? rows : rows.filter(row => row.status === status)
  const scopedRows = applyStandardFilters(statusRows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdAt']
  })
  const renderWorkflowStatus = value => {
    const step = applicationWorkflowStep(workflow, supplyChainMilestone('PURCHASE_ORDER', value))
    return <StatusBadge application="purchaseOrder" value={value} description={step?.stepName} tone={step?.badgeTone} />
  }

  // A link from another page can point at a single record; it narrows the list on arrival.
  const [focusReference, clearFocusReference] = useRecordFilter()
  const focusedRows = focusReference ? scopedRows.filter(row => matchesReference(row, focusReference, ['purchaseOrder', 'purchaseRequest', 'workOrder'])) : scopedRows
  const visibleRows = focusedRows

  const cancelOrder = row => onUpdateOrder?.(row.purchaseOrder, { status: 'CAN', cancelledAt: todayStamp() })
  const updateOrderStatus = (row, nextStatus) => {
    const datePatch = {
      APPR: { approvedAt: todayStamp() },
      INPRG: {},
      CLOSE: { receivedAt: todayStamp(), closedAt: todayStamp() }
    }[nextStatus] || {}
    onUpdateOrder?.(row.purchaseOrder, { status: nextStatus, ...datePatch })
  }

  const rowAction = row => {
    if (row.status === 'WAPPR') {
      if (!access.edit) return '-'
      return (
        <div className="flex flex-wrap gap-2">
          {access.edit && access.approve && <Button className="h-8 px-3 text-xs" onClick={() => updateOrderStatus(row, 'APPR')}><CheckCircle2 size={14} />Approve PO</Button>}
          {access.close && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelOrder(row)}><XCircle size={14} />Cancel</Button>}
        </div>
      )
    }
    if (row.status === 'APPR') {
      if (!access.edit) return '-'
      return (
        <div className="flex flex-wrap gap-2">
          <Button className="h-8 px-3 text-xs" onClick={() => updateOrderStatus(row, 'INPRG')}><Play size={14} />Start processing</Button>
          {access.close && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelOrder(row)}><XCircle size={14} />Cancel</Button>}
        </div>
      )
    }
    if (row.status === 'INPRG') {
      if (!access.edit) return '-'
      return (
        <div className="flex flex-wrap gap-2">
          {access.edit && access.close && <Button className="h-8 px-3 text-xs" onClick={() => updateOrderStatus(row, 'CLOSE')}><PackageCheck size={14} />Receive & close</Button>}
          {access.close && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelOrder(row)}><XCircle size={14} />Cancel</Button>}
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
      <RecordFilterNotice reference={focusReference} count={visibleRows.length} onClear={clearFocusReference} />
      <TablePanel>
        {visibleRows.length ? (
          <DataTable
            rows={visibleRows}
            rowKey="purchaseOrder"
            pagination
            columns={[
              { key: 'purchaseOrder', label: 'PO Number', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
              { key: 'purchaseRequest', label: 'Source PR' },
              { key: 'workOrder', label: 'Work Order', render: value => <RecordLink value={value} mono onClick={value && onOpenWorkOrder ? () => onOpenWorkOrder(value) : undefined} /> },
              { key: 'item', label: 'Item / Description', render: (value, row) => (
                <RecordLink
                  value={value || row.itemCode || 'Unnamed item'}
                  icon={Package}
                  onClick={row.itemCode || row.item ? () => openInventoryItem(row) : undefined}
                  title={`Open ${row.itemCode || value} to request a purchase`}
                />
              ) },
              { key: 'quantity', label: 'Quantity' },
              { key: 'source', label: 'Supplier / Store' },
              { key: 'site', label: 'Site' },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status', render: renderWorkflowStatus },
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
