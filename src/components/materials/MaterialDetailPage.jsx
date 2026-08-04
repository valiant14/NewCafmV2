import { useState } from 'react'
import Combobox from '../ui/Combobox'
import { Archive, BarChart3, Boxes, ClipboardList, PackageCheck, ShoppingCart, Warehouse } from 'lucide-react'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import DataTable from '../ui/DataTable'
import StatCard from '../ui/StatCard'
import TablePanel from '../ui/TablePanel'
import { SurfaceHeader } from '../ui/Surface'
import { stockForItem, storeLabel } from '../../lib/inventory'
import EmptyState from '../ui/EmptyState'
import GenericPrintReport from '../ui/GenericPrintReport'
import MasterRecordModal from '../master-data/MasterRecordModal'
import { statusTone } from '../../lib/statusMatrix'

const materialStatusTone = {
  Available: 'green',
  'Low Stock': 'orange',
  'Purchase Required': 'orange'
}

const materialStatuses = ['Available', 'Low Stock', 'Purchase Required']

function stockState(material) {
  const available = Math.max(0, Number(material.balance || 0) - Number(material.reserved || 0))
  const reorderLevel = Number(material.reorderLevel || 0)
  const coverage = reorderLevel ? Math.min(100, Math.round((available / reorderLevel) * 100)) : 100
  const needsPurchase = material.availability === 'Purchase Required' || available <= reorderLevel

  return { available, coverage, needsPurchase }
}

const matchesMaterial = (material, row) => {
  const item = String(row.itemCode || row.item || '').trim().toLowerCase()
  return item === String(material.itemNumber || '').trim().toLowerCase() || item === String(material.description || '').trim().toLowerCase()
}

export default function MaterialDetailPage({ material, stockRows = [], storeRows = [], usageRows = [], purchaseRequests = [], purchaseOrders = [], onBack, onUpdate, onCreateRequest, onUpdateStock }) {
  const [tab, setTab] = useState('Material Details')
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestForm, setRequestForm] = useState({})
  const [requestError, setRequestError] = useState('')
  const [reorderDrafts, setReorderDrafts] = useState({})
  const stock = stockState(material)
  const storeStock = stockForItem(material.itemNumber, stockRows).map(row => ({
    ...row,
    storeName: storeLabel(row.storeroom, storeRows),
    available: Math.max(0, Number(row.balance || 0) - Number(row.reserved || 0))
  }))
  const tone = materialStatusTone[material.availability] || 'green'
  const canRequestPr = ['Low Stock', 'Purchase Required'].includes(material.availability)
  const changeStatus = event => onUpdate?.(material.itemNumber, { availability: event.target.value })
  const procurementRows = [
    ...purchaseRequests.filter(row => matchesMaterial(material, row)).map(row => ({ ...row, recordType: 'PR', reference: row.purchaseRequest, linked: row.purchaseOrder || '-' })),
    ...purchaseOrders.filter(row => matchesMaterial(material, row)).map(row => ({ ...row, recordType: 'PO', reference: row.purchaseOrder, linked: row.purchaseRequest || '-' }))
  ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  const defaultSource = () => stockForItem(material.itemNumber, stockRows)[0]?.storeroom || storeRows.find(store => store.status !== 'Inactive')?.code || storeRows[0]?.code || ''
  const reorderDraftValue = row => reorderDrafts[row.storeroom] ?? row.reorderLevel ?? 0
  const updateReorderDraft = (row, value) => setReorderDrafts(current => ({ ...current, [row.storeroom]: value }))
  const saveReorderLevel = row => {
    const value = Math.max(0, Number(reorderDraftValue(row)) || 0)
    setReorderDrafts(current => ({ ...current, [row.storeroom]: value }))
    onUpdateStock?.(row.storeroom, material.itemNumber, { reorderLevel: value })
  }
  const openRequestModal = () => {
    const source = defaultSource()
    const quantity = Math.max(1, Number(material.reorderLevel || 0) - Number(stock.available || 0))
    setRequestForm({
      quantity,
      source,
      site: storeRows.find(store => store.code === source)?.site || material.site || '',
      department: material.department || material.category || ''
    })
    setRequestError('')
    setRequestModalOpen(true)
  }
  const requestPr = () => {
    const quantity = Number(requestForm.quantity || 0)
    if (!quantity || quantity <= 0) return setRequestError('Enter a requested quantity above zero.')
    onCreateRequest?.({
      type: 'Material',
      item: material.description,
      itemCode: material.itemNumber,
      quantity,
      plannedQuantity: quantity,
      availableQuantity: stock.available,
      source: requestForm.source || defaultSource(),
      site: requestForm.site || material.site || '',
      department: requestForm.department || material.department || material.category || ''
    })
    setRequestModalOpen(false)
    setTab('Procurement History')
  }

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="INVENTORY MATERIAL"
          id={material.itemNumber}
          title={material.description}
          status={material.availability}
          statusTone={tone}
          onBack={onBack}
          backLabel="Back to materials"
          stats={[
            { label: 'Unit', value: material.unit },
            { label: 'Stores', value: storeStock.map(row => row.storeName).join(', ') || 'Not stocked' },
            { label: 'Available Balance', value: `${stock.available} ${material.unit}` },
            { label: 'Reserved', value: `${material.reserved || 0} ${material.unit}` }
          ]}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              {canRequestPr && <Button onClick={openRequestModal}><ShoppingCart size={15} />Request PR</Button>}
              <div className="min-w-[180px]">
              <Combobox
                picker
                className="h-10 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
                value={material.availability}
                suggestions={materialStatuses}
                onChange={changeStatus}
                placeholder="Status"
              />
            </div>
            </div>
          )}
        />

        <DetailTabs tabs={['Material Details', 'Work Order Usage', 'Procurement History']} active={tab} onChange={setTab} />

        {tab === 'Material Details' && <main className="space-y-4">
          <section className="grid gap-3 md:grid-cols-4">
            {[
              { icon: Boxes, label: 'Balance', value: material.balance, note: `Total ${material.unit}` },
              { icon: ClipboardList, label: 'Reserved', value: material.reserved || 0, note: 'Committed' },
              { icon: PackageCheck, label: 'Available', value: stock.available, note: `Ready ${material.unit}` },
              { icon: BarChart3, label: 'Low Level', value: material.reorderLevel, note: `${stock.coverage}% coverage` }
            ].map(metric => <StatCard key={metric.label} {...metric} detail={metric.note} tone="blue" />)}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
          <InfoCard
            icon={Archive}
            kicker="ITEM"
            title="Material Information"
            items={[
              ['Description', material.description],
              ['Item Number', material.itemNumber],
              ['Category', material.category],
              ['Unit', material.unit]
            ]}
          />

          <InfoCard
            icon={Warehouse}
            kicker="INVENTORY"
            title="Stock Control"
            items={[
              ['Stores', storeStock.map(row => row.storeName).join(', ') || 'Not stocked'],
              ['Current Balance', material.balance],
              ['Reserved', material.reserved],
              ['Available Balance', stock.available],
              ['Availability', material.availability]
            ]}
          />
          </section>

          <TablePanel className="lg:col-span-2">
            <SurfaceHeader eyebrow="Store inventory" title={`Held in ${storeStock.length} store${storeStock.length === 1 ? '' : 's'}`} />
            <DataTable
              rows={storeStock}
              rowKey="storeroom"
              showFooter={false}
              columns={[
                { key: 'storeName', label: 'Store' },
                { key: 'storeroom', label: 'Store Code', render: value => <strong className="mono">{value}</strong> },
                { key: 'balance', label: 'Balance' },
                { key: 'reserved', label: 'Reserved' },
                { key: 'available', label: 'Available' },
                { key: 'reorderLevel', label: 'Low Level', render: (_, row) => (
                  <input
                    type="number"
                    min="0"
                    value={reorderDraftValue(row)}
                    onChange={event => updateReorderDraft(row, event.target.value)}
                    onBlur={() => saveReorderLevel(row)}
                    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
                    className="app-field-control h-8 w-24 text-xs font-bold"
                    aria-label={`Low level for ${row.storeName || row.storeroom}`}
                  />
                ) }
              ]}
            />
          </TablePanel>
        </main>}

        {tab === 'Work Order Usage' && (
          <TablePanel>
            {usageRows.length ? (
              <DataTable
                rows={usageRows}
                rowKey="reference"
                pagination
                columns={[
                  { key: 'reference', label: 'Work Order', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
                  { key: 'description', label: 'Description' },
                  { key: 'workType', label: 'Type' },
                  { key: 'quantity', label: 'Consumed / Requested', render: (value, row) => `${value} ${row.unit || material.unit}` },
                  { key: 'source', label: 'Source' },
                  { key: 'department', label: 'Department' },
                  { key: 'site', label: 'Site' },
                  { key: 'status', label: 'WO Status', render: value => <Badge tone={statusTone(value)}>{value}</Badge> }
                ]}
              />
            ) : (
              <EmptyState
                icon={PackageCheck}
                title="No Work Order usage yet"
                description="Work Orders that consume, reserve, or request this material will appear here."
              />
            )}
          </TablePanel>
        )}
        {tab === 'Procurement History' && (
          <TablePanel>
            {procurementRows.length ? (
              <DataTable
                rows={procurementRows}
                rowKey="reference"
                pagination
                columns={[
                  { key: 'recordType', label: 'Type' },
                  { key: 'reference', label: 'Reference', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
                  { key: 'linked', label: 'Linked Record' },
                  { key: 'workOrder', label: 'Work Order' },
                  { key: 'quantity', label: 'Quantity' },
                  { key: 'source', label: 'Store' },
                  { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value}</Badge> },
                  { key: 'createdAt', label: 'Created' }
                ]}
              />
            ) : (
              <EmptyState icon={ShoppingCart} title="No procurement history yet" description="Purchase requisitions and orders for this material will appear here." />
            )}
          </TablePanel>
        )}
      </div>
      {requestModalOpen && (
        <MasterRecordModal
          title="Request purchase requisition"
          note="Enter the quantity and destination for this material request."
          fields={[
            { key: 'quantity', label: 'Requested Quantity', required: true, type: 'number', min: 1 },
            { key: 'source', label: 'Store', required: true, options: ['', ...storeRows.map(store => store.code).filter(Boolean)] }
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
        reportTitle="Material Report"
        reportSubtitle="Inventory material report"
        number={material.itemNumber}
        status={material.availability}
        description={material.description}
        summary={[['Category', material.category], ['Storeroom', material.storeroom], ['Available', `${stock.available} ${material.unit}`]]}
        sections={[
          { title: 'Material Information', rows: [[['Item Number', material.itemNumber], ['Description', material.description], ['Category', material.category], ['Unit', material.unit]]] },
          { title: 'Stock Position', rows: [[['Storeroom', material.storeroom], ['Balance', material.balance], ['Reserved', material.reserved], ['Available Balance', stock.available]]] },
          { title: 'Reorder Control', rows: [[['Low Level', material.reorderLevel], ['Status', material.availability], ['Coverage', `${stock.coverage}%`], ['Purchase Required', stock.needsPurchase ? 'Yes' : 'No']]] }
        ]}
      />
    </section>
  )
}
