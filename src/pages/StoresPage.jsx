import { useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, ChevronRight, ClipboardList, Package, PackageCheck, Plus, Warehouse } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import { storeLocation, storeStockRows, storeSummary } from '../lib/inventory'
import { scopeRowsForUser } from '../lib/accessControl'
import { useAuth } from '../providers/AuthProvider'

const summaryColumns = [
  { key: 'code', label: 'Store' },
  { key: 'name', label: 'Store Name' },
  { key: 'location', label: 'Location Code' },
  { key: 'locationDescription', label: 'Location' },
  { key: 'site', label: 'Site' },
  { key: 'department', label: 'Department' },
  { key: 'itemCount', label: 'Items' },
  { key: 'totalQuantity', label: 'Total Quantity' }
]

const stockColumns = [
  { key: 'itemNumber', label: 'Item Number' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'unit', label: 'Unit' },
  { key: 'balance', label: 'Balance' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'available', label: 'Available' },
  { key: 'reorderLevel', label: 'Reorder Level' }
]

const emptyStore = {
  code: '',
  name: '',
  site: '1031',
  status: 'Active'
}
const storeFields = [
  { key: 'code', label: 'Store Code', required: true, placeholder: 'DIWAN-MAIN' },
  { key: 'name', label: 'Store Name', required: true, placeholder: 'Diwan Main Store' },
  { key: 'site', label: 'Site', required: true, placeholder: '1031' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }
]
const templateHeaders = Object.keys(emptyStore)

const normalizeImportRows = rows => rows.map(row => ({
  ...emptyStore,
  code: String(row.code || row.Code || row['Store Code'] || row.store_code || '').trim(),
  name: row.name || row.Name || row['Store Name'] || row.store_name || '',
  site: row.site || row.Site || row['Site Code'] || row.site_code || '1031',
  status: row.status || row.Status || 'Active'
})).filter(row => row.code && row.name)

const sumBy = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)
const availabilityTone = row => Number(row.available || 0) > Number(row.reorderLevel || 0) ? 'green' : Number(row.available || 0) > 0 ? 'orange' : 'red'
const allStockRows = (materials, stockRows, storeRows) => stockRows.map(row => {
  const material = materials.find(item => item.itemNumber === row.itemNumber) || {}
  const store = storeRows.find(item => item.code === row.storeroom) || {}
  const balance = Number(row.balance) || 0
  const reserved = Number(row.reserved) || 0
  const available = Math.max(0, balance - reserved)
  const reorderLevel = Number(row.reorderLevel ?? material.reorderLevel) || 0
  return {
    ...row,
    storeName: store.name || row.storeroom,
    description: material.description || row.itemNumber,
    category: material.category || '',
    balance,
    reserved,
    available,
    reorderLevel,
    status: available <= 0 ? 'No Stock' : available <= reorderLevel ? 'Low Stock' : 'Available'
  }
})
const cleanKey = value => String(value || '').trim().toLowerCase()
const matchesStore = (store, value) => [store.code, store.name].some(item => cleanKey(item) === cleanKey(value))
const toolRowsForStore = (store, tools = []) => tools
  .filter(tool => matchesStore(store, tool.location))
  .map(tool => ({
    itemNumber: tool.toolNumber,
    type: 'Tool',
    description: tool.description || tool.toolNumber,
    category: tool.category || '',
    unit: tool.unit || 'EA',
    balance: Number(tool.quantity) || 0,
    reserved: Number(tool.reservedQuantity) || 0,
    available: Math.max(0, Number(tool.availableQuantity ?? tool.quantity) || 0),
    reorderLevel: Number(tool.lowLevel) || 0
  }))

function Widget({ icon: Icon, label, value, note, tone = 'neutral' }) {
  const toneClass = {
    green: 'bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]',
    orange: 'bg-[var(--app-badge-orange-bg)] text-[var(--app-badge-orange-text)]',
    blue: 'bg-[var(--app-badge-blue-bg)] text-[var(--app-badge-blue-text)]',
    neutral: 'bg-[var(--app-soft-bg)] text-[var(--app-muted)]'
  }[tone] || 'bg-[var(--app-soft-bg)] text-[var(--app-muted)]'
  return (
    <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-3.5 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${toneClass}`}><Icon size={16} /></span>
      </div>
      <strong className="mt-1.5 block text-2xl font-extrabold text-[var(--app-ink)]">{value}</strong>
      <small className="text-[11px] font-semibold text-[var(--app-muted)]">{note}</small>
    </div>
  )
}

export default function StoresPage({ materials = [], tools = [], stockRows = [], storeRows = [], setStoreRows, locationRows = [], scopeUser }) {
  const { user } = useAuth()
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyStore)
  const [error, setError] = useState('')
  const routeId = decodeURIComponent(window.location.pathname.split('/stores/')[1] || '')
  const summary = scopeRowsForUser(storeSummary(materials, stockRows, storeRows, locationRows), scopeUser || user, ['site'])
  const stockReportRows = allStockRows(materials, stockRows, storeRows)
  const lowStockRows = stockReportRows.filter(row => row.status !== 'Available')
  const totalBalance = sumBy(stockReportRows, 'balance')
  const totalReserved = sumBy(stockReportRows, 'reserved')
  const totalAvailable = sumBy(stockReportRows, 'available')
  const topStores = [...summary].sort((a, b) => Number(b.totalQuantity || 0) - Number(a.totalQuantity || 0)).slice(0, 5)
  const visibleRows = summary
  const [selected, setSelected] = useState(summary.find(store => store.code === routeId) || null)
  useEffect(() => {
    if (!routeId) return
    const latest = summary.find(store => store.code === routeId)
    if (latest) setSelected(latest)
  }, [summary, routeId])

  const open = store => {
    setSelected(store)
    window.history.pushState({}, '', `/stores/${encodeURIComponent(store.code)}`)
  }
  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/stores')
  }
  const openNew = () => {
    setForm(emptyStore)
    setError('')
    setModalOpen(true)
  }
  const save = () => {
    const code = String(form.code || '').trim()
    if (!code || !form.name) return setError('Complete store code and store name.')
    if (storeRows.some(store => store.code === code)) return setError('Store code already exists.')
    setStoreRows?.(current => [{ ...form, code }, ...current])
    setModalOpen(false)
    setForm(emptyStore)
  }
  const importRows = async rows => {
    const normalized = normalizeImportRows(rows)
    await setStoreRows?.(current => [
      ...normalized,
      ...current.filter(store => !normalized.some(row => row.code === store.code))
    ])
  }

  if (selected) {
    const materialRows = storeStockRows(selected.code, materials, stockRows).map(row => ({ ...row, type: 'Material' }))
    const rows = [...materialRows, ...toolRowsForStore(selected, tools)]
    const location = storeLocation(selected.code, storeRows, locationRows)
    return (
      <>
        <PageHeader
          eyebrow="STORE INVENTORY"
          title={selected.name}
          description={`${selected.code} · ${location ? `${location.location} — ${location.description}` : 'Location not linked'}`}
          actions={(
            <div className="flex items-center gap-2">
              <ExportExcelButton module={`Store ${selected.code}`} rows={rows} columns={[{ key: 'type', label: 'Type' }, ...stockColumns]} />
              <Button variant="outline" onClick={close}>Back to stores</Button>
            </div>
          )}
        />
        <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          {rows.length ? (
            <DataTable
              rows={rows}
              rowKey="itemNumber"
              pagination
              columns={[
                { key: 'type', label: 'Type' },
                ...stockColumns.slice(0, 6),
                { key: 'available', label: 'Available', render: (value, row) => (
                  <Badge tone={value > row.reorderLevel ? 'green' : 'orange'}>{value}</Badge>
                ) },
                { key: 'reorderLevel', label: 'Reorder Level' }
              ]}
            />
          ) : (
            <EmptyState icon={Package} title="No stock held" description="This store has no material records yet." />
          )}
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="SUPPLY CHAIN"
        title="Stores"
        description="Approved store locations and the materials held in each."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Stores_Template.xlsx" />
            <ExportExcelButton module="Stores" rows={visibleRows} columns={summaryColumns} />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={importRows} />
            <Button onClick={openNew}><Plus size={17} />Add store</Button>
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="stores" onClear={() => setImported('')} />
      <section className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Widget icon={Warehouse} label="Stores" value={summary.length} note={`${summary.filter(store => store.status === 'Active').length} active`} tone="blue" />
        <Widget icon={Package} label="Stocked Items" value={stockReportRows.length} note={`${materials.length} material masters`} />
        <Widget icon={BarChart3} label="Balance" value={totalBalance} note="Total on hand" tone="green" />
        <Widget icon={ClipboardList} label="Reserved" value={totalReserved} note="Committed to work" tone="orange" />
        <Widget icon={PackageCheck} label="Available" value={totalAvailable} note="Ready to issue" tone="green" />
        <Widget icon={AlertTriangle} label="Low / No Stock" value={lowStockRows.length} note="Needs attention" tone={lowStockRows.length ? 'orange' : 'green'} />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_.9fr]">
        <div className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <header className="border-b border-[var(--app-line)] px-4 py-3">
            <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">STOCK REPORT</p>
            <h2 className="text-base font-extrabold text-[var(--app-ink)]">Low and no stock items</h2>
          </header>
          {lowStockRows.length ? (
            <DataTable
              rows={lowStockRows.slice(0, 8)}
              rowKey={row => `${row.storeroom}-${row.itemNumber}`}
              showFooter={false}
              columns={[
                { key: 'itemNumber', label: 'Item', render: value => <strong className="mono">{value}</strong> },
                { key: 'description', label: 'Description' },
                { key: 'storeName', label: 'Store' },
                { key: 'available', label: 'Available' },
                { key: 'reorderLevel', label: 'Low Level' },
                { key: 'status', label: 'Status', render: (value, row) => <Badge tone={availabilityTone(row)}>{value}</Badge> }
              ]}
            />
          ) : (
            <EmptyState icon={PackageCheck} title="Stock levels look healthy" description="No material is below its configured low level." />
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
          <header className="border-b border-[var(--app-line)] px-4 py-3">
            <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">STORE REPORT</p>
            <h2 className="text-base font-extrabold text-[var(--app-ink)]">Largest stores by balance</h2>
          </header>
          <DataTable
            rows={topStores}
            rowKey="code"
            showFooter={false}
            columns={[
              { key: 'code', label: 'Store', render: value => <strong className="mono">{value}</strong> },
              { key: 'name', label: 'Name' },
              { key: 'itemCount', label: 'Items' },
              { key: 'totalQuantity', label: 'Balance' }
            ]}
          />
        </div>
      </section>
      <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable
          rows={visibleRows}
          rowKey="code"
          onRowClick={open}
          pagination
          columns={[
            { key: 'code', label: 'Store', render: value => <strong className="mono">{value}</strong> },
            { key: 'name', label: 'Store Name' },
            { key: 'location', label: 'Location', render: (value, row) => (
              <span><strong className="mono">{value}</strong><small className="mt-1 block text-[9px] text-[var(--app-muted)]">{row.locationDescription}</small></span>
            ) },
            { key: 'department', label: 'Department' },
            { key: 'itemCount', label: 'Items' },
            { key: 'totalQuantity', label: 'Total Quantity' },
            { key: 'belowReorder', label: 'Below Reorder', render: value => (
              <Badge tone={value ? 'orange' : 'green'}>{value}</Badge>
            ) },
            { key: 'open', label: '', render: () => <ChevronRight size={17} /> }
          ]}
        />
      </section>
      {modalOpen && (
        <MasterRecordModal
          title="Add store"
          note="Create an approved storeroom for material stock and purchase requests."
          fields={storeFields}
          form={form}
          setForm={setForm}
          error={error}
          submitLabel="Create store"
          onClose={() => setModalOpen(false)}
          onSave={save}
        />
      )}
    </>
  )
}
