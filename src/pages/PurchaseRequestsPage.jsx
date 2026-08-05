import { useState } from 'react'
import { CheckCircle2, Plus, ShoppingCart, XCircle } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import TablePanel from '../components/ui/TablePanel'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { nowLocalDate } from '../lib/datetime'
import useModuleAccess from '../hooks/useModuleAccess'

const todayStamp = () => nowLocalDate()
const purchaseRequisitionStatuses = ['WAPPR', 'APPR', 'CLOSE', 'CAN']

const emptyRequest = { type: 'Material', item: '', quantity: 1, source: '', site: '', department: '', workOrder: '' }

const buildRequestFields = ({ siteRecords = [], departmentRecords = [], materials = [], tools = [], storeRows = [] }) => [
  { key: 'type', label: 'Type', options: ['Material', 'Tool', 'Equipment'] },
  { key: 'item', label: 'Item', required: true, options: ['', ...materials.map(material => material.description || material.itemNumber).filter(Boolean), ...tools.map(tool => tool.description || tool.toolNumber).filter(Boolean)] },
  { key: 'quantity', label: 'Quantity', required: true, type: 'number', min: 1 },
  { key: 'source', label: 'Store', options: ['', ...storeRows.map(store => store.code).filter(Boolean)] },
  { key: 'site', label: 'Site', required: true, suggestions: siteRecords.filter(site => site.status !== 'Inactive').map(site => ({ value: site.code, label: site.name })), placeholder: 'Select a site' },
  { key: 'department', label: 'Department', suggestions: [...new Map(departmentRecords.filter(department => department.status !== 'Inactive' && department.department).map(department => [department.department, department.department])).values()], placeholder: 'Search department' },
  { key: 'workOrder', label: 'Work Order (optional)', placeholder: 'Leave blank for a store restock' }
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

  const linkedPoFor = row => purchaseOrders.find(order => order.purchaseRequest === row.purchaseRequest) || null
  const rowsWithPo = rows.map(row => {
    const linkedPo = linkedPoFor(row)
    const status = linkedPo?.status === 'CLOSE' ? 'CLOSE' : linkedPo ? (row.status === 'WAPPR' ? 'APPR' : row.status) : row.status
    return linkedPo ? { ...row, status, purchaseOrder: row.purchaseOrder || linkedPo.purchaseOrder } : row
  })
  const requestRows = requestStatus === 'All' ? rowsWithPo : rowsWithPo.filter(row => row.status === requestStatus)

  const visibleRows = applyStandardFilters(requestRows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdAt']
  })

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
          {access.edit && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelRequest(row)}><XCircle size={14} />Cancel</Button>}
        </div>
      )
    }
    if (row.status === 'APPR') {
      if (!access.edit) return '-'
      return (
        <div className="flex flex-wrap gap-2">
          {access.edit && access.close && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => closeRequest(row)}><CheckCircle2 size={14} />Close PR</Button>}
          {access.edit && <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => cancelRequest(row)}><XCircle size={14} />Cancel</Button>}
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
      <TablePanel>
        {visibleRows.length ? (
          <DataTable
            rows={visibleRows}
            rowKey="purchaseRequest"
            pagination
            columns={[
              { key: 'purchaseRequest', label: 'PR Number', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
              { key: 'workOrder', label: 'Work Order' },
              { key: 'item', label: 'Item / Description' },
              // The figure is the shortfall, so show the arithmetic behind it - an approver
              // seeing "1" against a job that plans 2 needs to know why.
              { key: 'quantity', label: 'Quantity', render: (value, row) => (
                Number(row.plannedQuantity) > Number(value)
                  ? <span><strong>{value}</strong><small className="mt-1 block text-[9px] text-[var(--app-muted)]">{row.plannedQuantity} planned · {row.availableQuantity} in stock</small></span>
                  : value
              ) },
              { key: 'source', label: 'Requested From' },
              { key: 'purchaseOrder', label: 'Linked PO', render: value => value || 'Not created' },
              { key: 'site', label: 'Site' },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status', render: value => <StatusBadge application="purchaseRequisition" value={value} /> },
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
