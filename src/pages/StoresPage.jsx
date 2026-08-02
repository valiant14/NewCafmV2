import { useState } from 'react'
import { ChevronRight, Package, Plus, Warehouse } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { storeLocation, storeStockRows, storeSummary } from '../lib/inventory'
import { scopeRowsForUser } from '../lib/accessControl'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
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

export default function StoresPage({ materials = [], stockRows = [], storeRows = [], setStoreRows, locationRows = [], scopeUser }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyStore)
  const [error, setError] = useState('')
  const routeId = decodeURIComponent(window.location.pathname.split('/stores/')[1] || '')
  const summary = scopeRowsForUser(storeSummary(materials, stockRows, storeRows, locationRows), scopeUser || user, ['site'])
  const tabRows = tab === 'All'
    ? summary
    : tab === 'Below Reorder'
      ? summary.filter(store => Number(store.belowReorder || 0) > 0)
      : summary.filter(store => store.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status']
  })
  const [selected, setSelected] = useState(summary.find(store => store.code === routeId) || null)

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
    const rows = storeStockRows(selected.code, materials, stockRows)
    const location = storeLocation(selected.code, storeRows, locationRows)
    return (
      <>
        <PageHeader
          eyebrow="STORE INVENTORY"
          title={selected.name}
          description={`${selected.code} · ${location ? `${location.location} — ${location.description}` : 'Location not linked'}`}
          actions={(
            <div className="flex items-center gap-2">
              <ExportExcelButton module={`Store ${selected.code}`} rows={rows} columns={stockColumns} />
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
      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Stores', count: summary.length },
          { key: 'Active', label: 'Active', count: summary.filter(store => store.status === 'Active').length },
          { key: 'Inactive', label: 'Inactive', count: summary.filter(store => store.status === 'Inactive').length },
          { key: 'Below Reorder', label: 'Below Reorder', count: summary.filter(store => Number(store.belowReorder || 0) > 0).length }
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(summary, ['site'])}
        departmentOptions={optionsFromRows(summary, ['department'])}
        statusOptions={optionsFromRows(summary, ['status'])}
      />
      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
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
