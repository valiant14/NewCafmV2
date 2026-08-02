import { useState } from 'react'
import { CheckCircle2, Plus, ShoppingCart, XCircle } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { statusDescription, statusTone } from '../lib/statusMatrix'
import { nowLocalDate } from '../lib/datetime'
import { departments, materials as materialsSeed } from '../data/workspaceData'
import { stores } from '../lib/inventory'

const todayStamp = () => nowLocalDate()
const purchaseRequisitionStatuses = ['WAPPR', 'APPR', 'CLOSE', 'CAN']

const emptyRequest = { type: 'Material', item: '', quantity: 1, source: '', site: '1031', department: '', workOrder: '' }

const requestFields = [
  { key: 'type', label: 'Type', options: ['Material', 'Tool', 'Equipment'] },
  { key: 'item', label: 'Item', required: true, options: ['', ...materialsSeed.map(material => material.description)] },
  { key: 'quantity', label: 'Quantity', required: true, type: 'number', min: 1 },
  { key: 'source', label: 'Store', options: ['', ...stores.map(store => store.code)] },
  { key: 'site', label: 'Site', required: true, placeholder: '1031' },
  { key: 'department', label: 'Department', options: ['', ...departments.map(department => department.name)] },
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
  onApproveRequest,
  onUpdateRequest,
  onCreateRequest
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyRequest)
  const [formError, setFormError] = useState('')
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
        actions={(
          <div className="flex items-center gap-2">
            <ExportExcelButton module="Purchase Requisitions" rows={visibleRows} columns={exportColumns} />
            <Button onClick={() => { setForm(emptyRequest); setFormError(''); setModalOpen(true) }}><Plus size={17} />New purchase request</Button>
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
          onSave={() => {
            if (!form.item || !Number(form.quantity)) return setFormError('Choose an item and a quantity above zero.')
            onCreateRequest?.({ ...form, quantity: Number(form.quantity) })
            setModalOpen(false)
            setForm(emptyRequest)
            setFormError('')
          }}
        />
      )}
    </section>
  )
}
