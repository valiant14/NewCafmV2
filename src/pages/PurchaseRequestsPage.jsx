import { useState } from 'react'
import { Boxes, Building2, CheckCircle2, ClipboardList, Layers, Package, Plus, ShoppingCart, Users, Warehouse, XCircle } from 'lucide-react'
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
import ExportExcelButton from '../components/ui/ExportExcelButton'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { nowLocalDate } from '../lib/datetime'
import useModuleAccess from '../hooks/useModuleAccess'
import { applicationWorkflowStep, supplyChainMilestone } from '../lib/applicationWorkflow'

const todayStamp = () => nowLocalDate()
const purchaseRequisitionStatuses = ['WAPPR', 'APPR', 'CLOSE', 'CAN']

const emptyRequest = { type: 'Material', item: '', quantity: 1, source: '', site: '', department: '', workOrder: '' }

const request = { section: 'Request', sectionIcon: ShoppingCart, sectionNote: 'What is being bought and how much of it', sectionSpan: 'full' }
const routing = { section: 'Routing', sectionIcon: Building2, sectionNote: 'Where it is going - leave the work order blank to restock a store', sectionTone: 'green', sectionSpan: 'full' }

const buildRequestFields = ({ siteRecords = [], departmentRecords = [], materials = [], tools = [], storeRows = [] }) => [
  { ...request, key: 'type', label: 'Type', icon: Layers, options: ['Material', 'Tool', 'Equipment'] },
  { ...request, key: 'item', label: 'Item', icon: Package, required: true, options: ['', ...materials.map(material => material.description || material.itemNumber).filter(Boolean), ...tools.map(tool => tool.description || tool.toolNumber).filter(Boolean)] },
  { ...request, key: 'quantity', label: 'Quantity', icon: Boxes, required: true, type: 'number', min: 1 },
  { ...request, key: 'source', label: 'Store', icon: Warehouse, options: ['', ...storeRows.map(store => store.code).filter(Boolean)] },
  { ...routing, key: 'site', label: 'Site', icon: Building2, required: true, suggestions: siteRecords.filter(site => site.status !== 'Inactive').map(site => ({ value: site.code, label: site.name })), placeholder: 'Select a site' },
  { ...routing, key: 'department', label: 'Department', icon: Users, suggestions: [...new Map(departmentRecords.filter(department => department.status !== 'Inactive' && department.department).map(department => [department.department, department.department])).values()], placeholder: 'Search department' },
  { ...routing, key: 'workOrder', label: 'Work Order (optional)', icon: ClipboardList, placeholder: 'Leave blank for a store restock' }
]

const exportColumns = [
  { key: 'purchaseRequest', label: 'PR Number' },
  { key: 'type', label: 'Type' },
  { key: 'item', label: 'Item' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'source', label: 'Store' },
  { key: 'site', label: 'Site' },
  { key: 'department', label: 'Department' },
  { key: 'workOrder', label: 'Work Order' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created' },
  { key: 'purchaseOrder', label: 'Purchase Order' }
]

export default function PurchaseRequestsPage({
  rows = [],
  purchaseOrders = [],
  materials = [],
  tools = [],
  storeRows = [],
  siteRecords = [],
  departmentRecords = [],
  onOpenWorkOrder,
  workflow,
  onApproveRequest,
  onUpdateRequest,
  onCreateRequest
}) {
  const access = useModuleAccess('Purchase Requisitions')
  const purchaseOrderAccess = useModuleAccess('Purchase Orders')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyRequest)
  const [formError, setFormError] = useState('')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [requestStatus, setRequestStatus] = useState('All')
  const requestFields = buildRequestFields({ siteRecords, departmentRecords, materials, tools, storeRows })
  const renderWorkflowStatus = value => {
    const step = applicationWorkflowStep(workflow, supplyChainMilestone('PURCHASE_REQUISITION', value))
    return <StatusBadge application="purchaseRequisition" value={value} description={step?.stepName} tone={step?.badgeTone} />
  }

  const linkedPoFor = row => purchaseOrders.find(order => order.purchaseRequest === row.purchaseRequest) || null
  const rowsWithPo = rows.map(row => {
    const linkedPo = linkedPoFor(row)
    const status = linkedPo?.status === 'CLOSE' ? 'CLOSE' : linkedPo ? (row.status === 'WAPPR' ? 'APPR' : row.status) : row.status
    return linkedPo ? { ...row, status, purchaseOrder: row.purchaseOrder || linkedPo.purchaseOrder } : row
  })
  const requestRows = requestStatus === 'All' ? rowsWithPo : rowsWithPo.filter(row => row.status === requestStatus)

  const scopedRows = applyStandardFilters(requestRows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdAt']
  })

  // A link from another page can point at a single record; it narrows the list on arrival.
  const [focusReference, clearFocusReference] = useRecordFilter()
  const focusedRows = focusReference ? scopedRows.filter(row => matchesReference(row, focusReference, ['purchaseRequest', 'workOrder', 'purchaseOrder'])) : scopedRows
  const visibleRows = focusedRows

  const approveRequest = async row => onApproveRequest?.(row)
  const closeRequest = row => onUpdateRequest?.(row.purchaseRequest, { status: 'CLOSE', closedAt: todayStamp() })
  const cancelRequest = row => onUpdateRequest?.(row.purchaseRequest, { status: 'CAN', cancelledAt: todayStamp() })

  const requestAction = row => {
    if (row.purchaseOrder || linkedPoFor(row)) {
      return row.status === 'CLOSE'
        ? <Badge tone="green">Closed</Badge>
        : <Badge tone="blue">PO created</Badge>
    }
    if (row.status === 'WAPPR') {
      const canApprove = access.edit && access.approve && purchaseOrderAccess.create
      if (!canApprove && !access.edit) return '-'
      return (
        <div className="flex flex-wrap gap-2">
          {canApprove && <Button className="h-8 px-3 text-xs" onClick={() => approveRequest(row)}><CheckCircle2 size={14} />Approve & create PO</Button>}
          {access.close && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelRequest(row)}><XCircle size={14} />Cancel</Button>}
        </div>
      )
    }
    if (row.status === 'APPR') {
      if (!access.edit) return '-'
      return (
        <div className="flex flex-wrap gap-2">
          {access.edit && access.close && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => closeRequest(row)}><CheckCircle2 size={14} />Close PR</Button>}
          {access.close && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelRequest(row)}><XCircle size={14} />Cancel</Button>}
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
        actions={(
          <div className="flex items-center gap-2">
            <ExportExcelButton module="Purchase Requisitions" rows={visibleRows} columns={exportColumns} />
            {access.create && <Button onClick={() => { setForm(emptyRequest); setFormError(''); setModalOpen(true) }}><Plus size={17} />New purchase request</Button>}
          </div>
        )}
      />
      <IndexTabs
        active={requestStatus}
        onChange={setRequestStatus}
        tabs={[
          { key: 'All', label: 'All PRs', count: rows.length },
          ...purchaseRequisitionStatuses.map(status => ({
            key: status,
            label: status,
            count: rowsWithPo.filter(row => row.status === status).length
          }))
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rowsWithPo, ['site'])}
        departmentOptions={optionsFromRows(rowsWithPo, ['department'])}
        statusOptions={purchaseRequisitionStatuses}
      />
      <RecordFilterNotice reference={focusReference} count={visibleRows.length} onClear={clearFocusReference} />
      <TablePanel tone="purple">
        {visibleRows.length ? (
          <DataTable
            rows={visibleRows}
            rowKey="purchaseRequest"
            pagination
            columns={[
              { key: 'purchaseRequest', label: 'PR Number', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
              { key: 'workOrder', label: 'Work Order', render: value => <RecordLink value={value} mono onClick={value && onOpenWorkOrder ? () => onOpenWorkOrder(value) : undefined} /> },
              { key: 'item', label: 'Item / Description', render: (value, row) => (
                <RecordLink
                  value={value || row.itemCode || 'Unnamed item'}
                  icon={Package}
                  onClick={row.itemCode || row.item ? () => openInventoryItem(row) : undefined}
                  title={`Open ${row.itemCode || value} to request a purchase`}
                />
              ) },
              // The figure is the shortfall, so show the arithmetic behind it - an approver
              // seeing "1" against a job that plans 2 needs to know why.
              { key: 'quantity', label: 'Quantity', render: (value, row) => (
                Number(row.plannedQuantity) > Number(value)
                  ? <span><Badge tone="orange">{Number(value) || 0}</Badge><small className="mt-1 block text-[9px] text-[var(--app-muted)]">{row.plannedQuantity} planned · {row.availableQuantity} in stock</small></span>
                  : <Badge tone="blue">{Number(value) || 0}</Badge>
              ) },
              { key: 'source', label: 'Requested From' },
              { key: 'purchaseOrder', label: 'Linked PO', render: value => value ? <Badge tone="green">{value}</Badge> : <span className="text-[var(--app-muted)]">Not created</span> },
              { key: 'site', label: 'Site' },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status', render: renderWorkflowStatus },
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
      </TablePanel>
      {modalOpen && (
        <MasterRecordModal
          title="New purchase request"
          note="Raise a request directly. Leave the work order blank when restocking a store."
          fields={requestFields}
          form={form}
          setForm={setForm}
          error={formError}
          submitLabel="Create request"
          onClose={() => { setModalOpen(false); setFormError('') }}
          onSave={async () => {
            if (!form.item || !Number(form.quantity)) return setFormError('Choose an item and a quantity above zero.')
            const created = await onCreateRequest?.({ ...form, quantity: Number(form.quantity) })
            if (!created) return setFormError('Unable to create the purchase requisition.')
            setModalOpen(false)
            setForm(emptyRequest)
            setFormError('')
          }}
        />
      )}
    </section>
  )
}
