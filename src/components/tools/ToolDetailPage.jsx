import { useState } from 'react'
import Combobox from '../ui/Combobox'
import { BarChart3, ClipboardCheck, MapPin, ShieldCheck, ShoppingCart, Wrench } from 'lucide-react'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import DataTable from '../ui/DataTable'
import Alert from '../ui/Alert'
import StatCard from '../ui/StatCard'
import TablePanel from '../ui/TablePanel'
import RecordLink from '../ui/RecordLink'
import { SurfaceHeader } from '../ui/Surface'
import EmptyState from '../ui/EmptyState'
import GenericPrintReport from '../ui/GenericPrintReport'
import MasterRecordModal from '../master-data/MasterRecordModal'
import { statusTone as workOrderStatusTone } from '../../lib/statusMatrix'
import useModuleAccess from '../../hooks/useModuleAccess'

const statusTone = {
  Available: 'green',
  Allocated: 'orange',
  Maintenance: 'orange'
}

const toolStatuses = ['Available', 'Allocated', 'Maintenance']
const matchesTool = (tool, row) => {
  const item = String(row.itemCode || row.item || '').trim().toLowerCase()
  return item === String(tool.toolNumber || '').trim().toLowerCase() || item === String(tool.description || '').trim().toLowerCase()
}

function daysUntil(dateValue) {
  if (!dateValue) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateValue}T00:00:00`)
  return Math.ceil((target - today) / 86400000)
}

function inspectionState(tool) {
  const days = daysUntil(tool.inspectionDue)
  if (days === null) return { days, dueSoon: false, overdue: false, label: 'Inspection not scheduled' }
  const dueSoon = days !== null && days <= 30
  const overdue = days !== null && days < 0
  const label = overdue ? 'Inspection overdue' : dueSoon ? 'Inspection due soon' : 'Inspection current'

  return { days, dueSoon, overdue, label }
}

export default function ToolDetailPage({ tool, usageRows = [], purchaseRequests = [], purchaseOrders = [], onBack, onUpdate, onCreateRequest, onOpenWorkOrder }) {
  const access = useModuleAccess('Tools & Equipment')
  const purchaseRequestAccess = useModuleAccess('Purchase Requisitions')
  const [tab, setTab] = useState('Tool Details')
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestForm, setRequestForm] = useState({})
  const [requestError, setRequestError] = useState('')
  const [lowLevelDraft, setLowLevelDraft] = useState(tool.lowLevel || 0)
  const inspection = inspectionState(tool)
  const tone = statusTone[tool.status] || 'green'
  const availableUnits = Number(tool.availableQuantity ?? (tool.status === 'Available' ? tool.quantity : 0)) || 0
  const canRequestPr = purchaseRequestAccess.create && ['Low Stock', 'No Stock'].includes(tool.availability)
  const changeStatus = event => onUpdate?.(tool.toolNumber, { status: event.target.value })
  const saveLowLevel = () => onUpdate?.(tool.toolNumber, { lowLevel: Math.max(0, Number(lowLevelDraft) || 0) })
  const procurementRows = [
    ...purchaseRequests.filter(row => matchesTool(tool, row)).map(row => ({ ...row, recordType: 'PR', reference: row.purchaseRequest, linked: row.purchaseOrder || '-' })),
    ...purchaseOrders.filter(row => matchesTool(tool, row)).map(row => ({ ...row, recordType: 'PO', reference: row.purchaseOrder, linked: row.purchaseRequest || '-' }))
  ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  const openRequestModal = () => {
    const quantity = Math.max(1, Number(tool.quantity || 0) - Number(tool.availableQuantity || 0) || 1)
    setRequestForm({
      quantity,
      source: tool.location || '',
      site: tool.site || ''
    })
    setRequestError('')
    setRequestModalOpen(true)
  }
  const requestPr = async () => {
    const quantity = Number(requestForm.quantity || 0)
    if (!quantity || quantity <= 0) return setRequestError('Enter a requested quantity above zero.')
    const created = await onCreateRequest?.({
      type: tool.category?.toLowerCase().includes('equipment') ? 'Equipment' : 'Tool',
      item: tool.description,
      itemCode: tool.toolNumber,
      quantity,
      plannedQuantity: quantity,
      availableQuantity: Number(tool.availableQuantity || 0),
      source: requestForm.source || tool.location || '',
      site: requestForm.site || tool.site || '',
      department: tool.department || ''
    })
    if (!created) return setRequestError('Unable to create the purchase requisition.')
    setRequestModalOpen(false)
    setTab('Procurement History')
  }

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="TOOL & EQUIPMENT"
          id={tool.toolNumber}
          title={tool.description}
          status={tool.status}
          statusTone={tone}
          onBack={onBack}
          backLabel="Back to tools"
          stats={[
            { label: 'Unit', value: tool.unit || 'EA' },
            { label: 'Stores', value: tool.stores || tool.location || 'Not stocked' },
            { label: 'Available Balance', value: `${availableUnits} ${tool.unit || 'EA'}` },
            { label: 'Low Level', value: tool.lowLevel || 0 }
          ]}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              {canRequestPr && <Button onClick={openRequestModal}><ShoppingCart size={15} />Request PR</Button>}
              {access.edit && <div className="min-w-[160px]">
              <Combobox
                picker
                className="h-10 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
                value={tool.status}
                suggestions={toolStatuses}
                onChange={changeStatus}
                placeholder="Status"
              />
            </div>}
            </div>
          )}
        />

        <DetailTabs tabs={['Tool Details', 'Work Order Usage', 'Procurement History']} active={tab} onChange={setTab} />

        {tab === 'Tool Details' && <main className="space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
            {[
              { icon: Wrench, label: 'Balance', value: tool.balance ?? tool.quantity, note: `Total ${tool.unit || 'EA'}`, tone: 'blue' },
              { icon: ClipboardCheck, label: 'Reserved', value: tool.reservedQuantity || 0, note: 'Committed', tone: 'purple' },
              { icon: ShieldCheck, label: 'Available', value: availableUnits, note: `Ready ${tool.unit || 'EA'}`, tone: availableUnits > 0 ? 'green' : 'orange' },
              { icon: BarChart3, label: 'Low Level', value: tool.lowLevel || 0, note: 'Restock trigger', tone: 'orange' }
            ].map(metric => <StatCard key={metric.label} {...metric} detail={metric.note} />)}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <InfoCard
              icon={Wrench}
              tone="blue"
              kicker="RESOURCE"
              title="Tool Information"
              items={[
                ['Description', tool.description],
                ['Tool Number', tool.toolNumber],
                ['Category', tool.category],
                ['Unit', tool.unit || 'EA']
              ]}
            />

            <InfoCard
              icon={MapPin}
              tone="green"
              kicker="CONTROL"
              title="Stock Position"
              items={[
                ['Stores', tool.stores || tool.location || 'Not stocked'],
                ['Current Balance', tool.balance ?? tool.quantity],
                ['Reserved', tool.reservedQuantity || 0],
                ['Available Balance', availableUnits],
                ['Availability', tool.availability || '-']
              ]}
            />
          </section>

          <TablePanel tone="green" className="lg:col-span-2">
            <SurfaceHeader eyebrow="Store inventory" title={`Held in ${tool.stores || tool.location || 'Tool Store'}`} />
            <DataTable
              rows={[tool]}
              rowKey="toolNumber"
              showFooter={false}
              columns={[
                { key: 'stores', label: 'Store', render: value => value || tool.location || 'Tool Store' },
                { key: 'toolNumber', label: 'Tool Code', render: value => <strong className="mono">{value}</strong> },
                { key: 'balance', label: 'Balance', render: value => value ?? tool.quantity },
                { key: 'reservedQuantity', label: 'Reserved' },
                { key: 'availableQuantity', label: 'Available' },
                { key: 'lowLevel', label: 'Low Level', render: () => (
                  <input
                    type="number"
                    min="0"
                    disabled={!access.edit}
                    value={lowLevelDraft}
                    onChange={event => setLowLevelDraft(event.target.value)}
                    onBlur={saveLowLevel}
                    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
                    className="app-field-control h-8 w-24 text-xs font-bold"
                    aria-label={`Low level for ${tool.description}`}
                  />
                ) }
              ]}
            />
          </TablePanel>

          {inspection.dueSoon && tool.inspectionDue && (
            <Alert tone="warning" icon={ShieldCheck} title={inspection.label}>Review inspection before assigning this tool or equipment to a Work Order.</Alert>
          )}
        </main>}

        {tab === 'Work Order Usage' && (
          <TablePanel tone="blue">
            {usageRows.length ? (
              <DataTable
                rows={usageRows}
                rowKey="reference"
                pagination
                columns={[
                  { key: 'reference', label: 'Work Order', render: value => <RecordLink value={value} mono onClick={value && onOpenWorkOrder ? () => onOpenWorkOrder(value) : undefined} /> },
                  { key: 'description', label: 'Description' },
                  { key: 'workType', label: 'Type' },
                  { key: 'quantity', label: 'Requested / Used' },
                  { key: 'source', label: 'Source' },
                  { key: 'department', label: 'Department' },
                  { key: 'site', label: 'Site' },
                  { key: 'status', label: 'WO Status', render: value => <Badge tone={workOrderStatusTone(value)}>{value}</Badge> }
                ]}
              />
            ) : (
              <EmptyState
                icon={Wrench}
                title="No Work Order usage yet"
                description="Work Orders that request, allocate, or use this tool/equipment will appear here."
              />
            )}
          </TablePanel>
        )}
        {tab === 'Procurement History' && (
          <TablePanel tone="purple">
            {procurementRows.length ? (
              <DataTable
                rows={procurementRows}
                rowKey="reference"
                pagination
                columns={[
                  { key: 'recordType', label: 'Type' },
                  { key: 'reference', label: 'Reference', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
                  { key: 'linked', label: 'Linked Record' },
                  { key: 'workOrder', label: 'Work Order', render: value => <RecordLink value={value} mono onClick={value && onOpenWorkOrder ? () => onOpenWorkOrder(value) : undefined} /> },
                  { key: 'quantity', label: 'Quantity' },
                  { key: 'source', label: 'Store / Location' },
                  { key: 'status', label: 'Status', render: value => <Badge tone={workOrderStatusTone(value)}>{value}</Badge> },
                  { key: 'createdAt', label: 'Created' }
                ]}
              />
            ) : (
              <EmptyState icon={ShoppingCart} title="No procurement history yet" description="Purchase requisitions and orders for this tool or equipment will appear here." />
            )}
          </TablePanel>
        )}
      </div>
      {requestModalOpen && (
        <MasterRecordModal
          title="Request purchase requisition"
          note="Enter the quantity and destination for this tool or equipment request."
          fields={[
            { key: 'quantity', label: 'Requested Quantity', required: true, type: 'number', min: 1 },
            { key: 'source', label: 'Store', required: true, placeholder: 'Main Tool Store' }
          ]}
          form={requestForm}
          setForm={setRequestForm}
          error={requestError}
          submitLabel="Create PR"
          onClose={() => setRequestModalOpen(false)}
          onSave={requestPr}
        />
      )}
      <GenericPrintReport
        reportTitle="Tool Report"
        reportSubtitle="Tool and equipment report"
        number={tool.toolNumber}
        status={tool.status}
        description={tool.description}
        summary={[['Category', tool.category], ['Stores', tool.stores || tool.location], ['Available', `${availableUnits} ${tool.unit || 'EA'}`]]}
        sections={[
          { title: 'Tool Information', rows: [[['Tool Number', tool.toolNumber], ['Description', tool.description], ['Category', tool.category], ['Unit', tool.unit || 'EA']]] },
          { title: 'Stock Position', rows: [[['Stores', tool.stores || tool.location], ['Balance', tool.balance ?? tool.quantity], ['Reserved', tool.reservedQuantity || 0], ['Available Balance', availableUnits]]] },
          { title: 'Stock Control', rows: [[['Low Level', tool.lowLevel || 0], ['Availability', tool.availability || '-'], ['Tool Status', tool.status], ['Request PR', canRequestPr ? 'Yes' : 'No']]] }
        ]}
      />
    </section>
  )
}
