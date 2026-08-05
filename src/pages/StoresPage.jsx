import { useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, ChevronRight, ClipboardList, Package, PackageCheck, Plus, Warehouse } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Combobox from '../components/ui/Combobox'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import Surface, { SurfaceHeader } from '../components/ui/Surface'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '../components/ui/ModalFrame'
// Shared with the summary builder - this page used to keep its own copy of the rule, so a
// store could pass one check and be dropped by the other.
import { isUsableStore, storeLocation, storeStockRows, storeSummary } from '../lib/inventory'
import { scopeRowsForUser } from '../lib/accessControl'
import { useAuth } from '../providers/AuthProvider'
import useModuleAccess from '../hooks/useModuleAccess'
import { mergeImportedRows } from '../lib/importRows'

const summaryColumns = [
  { key: 'code', label: 'Warehouse Code' },
  { key: 'name', label: 'Warehouse Name' },
  { key: 'location', label: 'Location Code' },
  { key: 'locationDescription', label: 'Location' },
  { key: 'site', label: 'Site' },
  { key: 'itemCount', label: 'Items Held' },
  { key: 'totalQuantity', label: 'On-Hand Quantity' },
  { key: 'status', label: 'Status' }
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

const storeStatuses = ['Active', 'Inactive']
const storeStatusTone = status => String(status || 'Active') === 'Inactive' ? 'orange' : 'green'

const emptyStore = {
  code: '',
  name: '',
  site: '',
  status: 'Active'
}
// Site options come from the site master and preserve the selected site code.
const storeFieldsFor = siteOptions => [
  { key: 'code', label: 'Store Code', required: true, placeholder: 'Enter warehouse code' },
  { key: 'name', label: 'Store Name', required: true, placeholder: 'Enter warehouse name' },
  { key: 'site', label: 'Site', required: true, suggestions: siteOptions, placeholder: 'Search or select a site' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }
]
const templateHeaders = Object.keys(emptyStore)

const normalizeImportRows = (rows, fallbackSite = '') => rows.map(row => ({
  ...emptyStore,
  code: String(row.code || row.Code || row['Store Code'] || row.store_code || '').trim(),
  name: row.name || row.Name || row['Store Name'] || row.store_name || '',
  site: row.site || row.Site || row['Site Code'] || row.site_code || fallbackSite,
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
const defaultStoreCode = (storeRows = []) => {
  const validStores = storeRows.filter(isUsableStore)
  const store = validStores.find(row => row.status !== 'Inactive') || validStores[0]
  return store?.code || store?.name || ''
}
const normalizedStoreCode = (value, storeRows = []) => {
  const raw = String(value || '').trim()
  const matched = storeRows.filter(isUsableStore).find(store => [store.code, store.name].some(item => cleanKey(item) === cleanKey(raw)))
  if (matched) return matched.code || matched.name
  return raw && !/^\d+$/.test(raw) ? raw : defaultStoreCode(storeRows)
}
const matchesStore = (store, value, storeRows = []) =>
  [store.code, store.name].some(item => cleanKey(item) === cleanKey(normalizedStoreCode(value, storeRows)))
const toolRowsForStore = (store, tools = [], storeRows = []) => tools
  .filter(tool => matchesStore(store, tool.location, storeRows))
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
const allToolRows = (tools = [], storeRows = []) => storeRows.filter(isUsableStore).flatMap(store =>
  toolRowsForStore(store, tools, storeRows).map(row => ({
    ...row,
    storeroom: store.code,
    storeName: store.name || store.code,
    status: Number(row.available || 0) <= 0 ? 'No Stock' : Number(row.available || 0) <= Number(row.reorderLevel || 0) ? 'Low Stock' : 'Available'
  }))
)

const inventoryRowKey = row => `${row.storeroom}-${row.itemNumber}`

const inventoryDrillColumns = [
  { key: 'itemNumber', label: 'Item', render: value => <strong className="mono">{value}</strong> },
  { key: 'description', label: 'Description' },
  { key: 'storeName', label: 'Store' },
  { key: 'balance', label: 'Balance' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'available', label: 'Available' },
  { key: 'reorderLevel', label: 'Low Level' },
  { key: 'status', label: 'Status', render: (value, row) => <Badge tone={availabilityTone(row)}>{value}</Badge> }
]

const storeDrillColumns = [
  { key: 'code', label: 'Warehouse', render: value => <strong className="mono">{value}</strong> },
  { key: 'name', label: 'Warehouse Name' },
  { key: 'site', label: 'Site' },
  { key: 'itemCount', label: 'Items Held' },
  { key: 'totalQuantity', label: 'On Hand' },
  { key: 'belowReorder', label: 'Low Stock', render: value => <Badge tone={value ? 'orange' : 'green'}>{value}</Badge> },
  { key: 'status', label: 'Status', render: value => <Badge tone={storeStatusTone(value)}>{value || 'Active'}</Badge> }
]

function Widget({ icon: Icon, label, value, note, tone = 'neutral', onClick }) {
  return <StatCard icon={Icon} label={label} value={value} detail={note} tone={tone} onClick={onClick} />
}

export default function StoresPage({ materials = [], tools = [], stockRows = [], storeRows = [], setStoreRows, locationRows = [], siteRecords = [], scopeUser }) {
  const { user } = useAuth()
  const access = useModuleAccess('Stores')
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [drill, setDrill] = useState(null)
  const [form, setForm] = useState(emptyStore)
  const [error, setError] = useState('')
  const routeId = decodeURIComponent(window.location.pathname.split('/stores/')[1] || '')
  const activeSites = siteRecords.filter(site => site.status !== 'Inactive')
  const siteOptions = activeSites.map(site => ({ value: site.code, label: site.name || '' }))
  const defaultSite = activeSites[0]?.code || ''
  const summary = scopeRowsForUser(storeSummary(materials, stockRows, storeRows, locationRows).map(store => {
    const toolRows = toolRowsForStore(store, tools, storeRows)
    const lowToolCount = toolRows.filter(row => Number(row.available || 0) <= Number(row.reorderLevel || 0)).length
    return {
      ...store,
      itemCount: Number(store.itemCount || 0) + toolRows.length,
      totalQuantity: Number(store.totalQuantity || 0) + sumBy(toolRows, 'balance'),
      belowReorder: Number(store.belowReorder || 0) + lowToolCount
    }
  }), scopeUser || user, ['site'])
  const stockReportRows = [...allStockRows(materials, stockRows, storeRows), ...allToolRows(tools, storeRows)]
  const lowStockRows = stockReportRows.filter(row => row.status !== 'Available')
  const totalBalance = sumBy(stockReportRows, 'balance')
  const totalReserved = sumBy(stockReportRows, 'reserved')
  const totalAvailable = sumBy(stockReportRows, 'available')
  const topStores = [...summary].sort((a, b) => Number(b.totalQuantity || 0) - Number(a.totalQuantity || 0)).slice(0, 5)
  const visibleRows = summary
  const [selected, setSelected] = useState(summary.find(store => store.code === routeId) || null)
  useEffect(() => {
    if (!routeId) {
      setSelected(null)
      return
    }
    setSelected(summary.find(store => store.code === routeId) || null)
  }, [summary, routeId])

  const open = store => {
    setSelected(store)
    window.history.pushState({}, '', `/stores/${encodeURIComponent(store.code)}`)
  }
  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/stores')
  }
  const openInventoryRow = row => {
    const basePath = row.type === 'Tool' ? '/tools' : '/materials'
    window.history.pushState({}, '', `${basePath}/${encodeURIComponent(row.itemNumber)}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  // Every headline figure on this page is a count or a sum of rows already in memory, so a
  // tile opens the rows it was calculated from rather than jumping to another page.
  const showStock = config => setDrill({
    rowKey: inventoryRowKey,
    columns: inventoryDrillColumns,
    exportColumns: stockColumns,
    onRowClick: row => { setDrill(null); openInventoryRow(row) },
    ...config
  })
  const showStores = () => setDrill({
    eyebrow: 'STORES',
    title: 'All stores',
    description: 'Every storeroom in your scope. Select one to open its stock list.',
    rows: summary,
    rowKey: 'code',
    columns: storeDrillColumns,
    exportColumns: summaryColumns,
    onRowClick: store => { setDrill(null); open(store) }
  })
  const openNew = () => {
    setForm({ ...emptyStore, site: defaultSite })
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
  // Status was captured when a store was created but never shown or editable afterwards,
  // so a store could not be retired or brought back once it existed.
  const updateStore = (code, patch) => {
    setStoreRows?.(current => current.map(store => store.code === code ? { ...store, ...patch } : store))
    setSelected(current => current?.code === code ? { ...current, ...patch } : current)
  }
  const importRows = async rows => {
    const normalized = normalizeImportRows(rows, defaultSite)
    await setStoreRows?.(current => mergeImportedRows(current, normalized, 'code'))
  }

  if (selected) {
    const materialRows = storeStockRows(selected.code, materials, stockRows).map(row => ({ ...row, type: 'Material' }))
    const rows = [...materialRows, ...toolRowsForStore(selected, tools, storeRows)]
    const location = storeLocation(selected.code, storeRows, locationRows)
    return (
      <>
        <PageHeader
          eyebrow="STORE INVENTORY"
          title={selected.name}
          description={`${selected.code} · ${location ? `${location.location} — ${location.description}` : 'Location not linked'}`}
          actions={(
            <div className="flex items-center gap-2">
              <div className="w-[160px]">
                <Combobox
                  picker
                  className="h-10 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
                  value={selected.status || 'Active'}
                  suggestions={storeStatuses}
                  onChange={event => updateStore(selected.code, { status: event.target.value })}
                  placeholder="Status"
                />
              </div>
              <ExportExcelButton module={`Store ${selected.code}`} rows={rows} columns={[{ key: 'type', label: 'Type' }, ...stockColumns]} />
              <Button variant="outline" onClick={close}>Back to stores</Button>
            </div>
          )}
        />
        <Surface flush>
          {rows.length ? (
            <DataTable
              rows={rows}
              rowKey="itemNumber"
              onRowClick={openInventoryRow}
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
        </Surface>
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
            {access.import && <ExcelImportButton fileName={imported} onFile={setImported} onImport={importRows} />}
            {access.create && <Button onClick={openNew}><Plus size={17} />Add store</Button>}
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="stores" onClear={() => setImported('')} />
      <section className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Widget
          icon={Warehouse}
          label="Stores"
          value={summary.length}
          note={`${summary.filter(store => String(store.status || 'Active') !== 'Inactive').length} active`}
          tone="blue"
          onClick={showStores}
        />
        <Widget
          icon={Package}
          label="Stocked Items"
          value={stockReportRows.length}
          note={`${materials.length} material / ${tools.length} tool masters`}
          onClick={() => showStock({
            eyebrow: 'STOCKED ITEMS',
            title: 'Every stocked item',
            description: 'Materials and tools held across all stores.',
            rows: stockReportRows
          })}
        />
        <Widget
          icon={BarChart3}
          label="Balance"
          value={totalBalance}
          note="Total on hand"
          tone="green"
          onClick={() => showStock({
            eyebrow: 'BALANCE',
            title: 'On-hand balance',
            description: `${totalBalance} units in total, largest holdings first.`,
            rows: [...stockReportRows].sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
          })}
        />
        <Widget
          icon={ClipboardList}
          label="Reserved"
          value={totalReserved}
          note="Committed to work"
          tone="orange"
          onClick={() => showStock({
            eyebrow: 'RESERVED',
            title: 'Reserved stock',
            description: `${totalReserved} units committed to work orders and reservations.`,
            rows: stockReportRows.filter(row => Number(row.reserved || 0) > 0)
          })}
        />
        <Widget
          icon={PackageCheck}
          label="Available"
          value={totalAvailable}
          note="Ready to issue"
          tone="green"
          onClick={() => showStock({
            eyebrow: 'AVAILABLE',
            title: 'Available to issue',
            description: `${totalAvailable} units free of any reservation.`,
            rows: stockReportRows.filter(row => Number(row.available || 0) > 0)
          })}
        />
        <Widget
          icon={AlertTriangle}
          label="Low / No Stock"
          value={lowStockRows.length}
          note="Needs attention"
          tone={lowStockRows.length ? 'orange' : 'green'}
          onClick={() => showStock({
            eyebrow: 'LOW / NO STOCK',
            title: 'Low and no stock items',
            description: 'Items at or below their configured low level.',
            rows: lowStockRows
          })}
        />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_.9fr]">
        <Surface as="div" flush>
          <SurfaceHeader eyebrow="Stock report" title="Low and no stock items" />
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
        </Surface>
        <Surface as="div" flush>
          <SurfaceHeader eyebrow="Store report" title="Largest stores by balance" />
          <DataTable
            rows={topStores}
            rowKey="code"
            showFooter={false}
            columns={[
              { key: 'code', label: 'Warehouse', render: value => <strong className="mono">{value}</strong> },
              { key: 'name', label: 'Warehouse Name' },
              { key: 'itemCount', label: 'Items Held' },
              { key: 'totalQuantity', label: 'On Hand' }
            ]}
          />
        </Surface>
      </section>
      <Surface className="mt-4" flush>
        <DataTable
          rows={visibleRows}
          rowKey="code"
          onRowClick={open}
          pagination
          columns={[
            { key: 'code', label: 'Warehouse', render: value => <strong className="mono">{value}</strong> },
            { key: 'name', label: 'Warehouse Name' },
            { key: 'location', label: 'Storage Location', render: (value, row) => (
              <span><strong className="mono">{value}</strong><small className="mt-1 block text-[9px] text-[var(--app-muted)]">{row.locationDescription}</small></span>
            ) },
            { key: 'itemCount', label: 'Items Held' },
            { key: 'totalQuantity', label: 'On-Hand Quantity' },
            { key: 'belowReorder', label: 'Low Stock Items', render: value => (
              <Badge tone={value ? 'orange' : 'green'}>{value}</Badge>
            ) },
            { key: 'status', label: 'Status', render: value => <Badge tone={storeStatusTone(value)}>{value || 'Active'}</Badge> },
            { key: 'open', label: '', render: () => <ChevronRight size={17} /> }
          ]}
        />
      </Surface>
      {drill && (
        <ModalOverlay>
          <ModalPanel className="max-w-6xl" labelledBy="stores-drilldown-title">
            <ModalHeader
              eyebrow={drill.eyebrow}
              title={drill.title}
              titleId="stores-drilldown-title"
              description={drill.description}
              onClose={() => setDrill(null)}
            />
            <div className="overflow-auto px-6 py-5">
              {drill.rows.length ? (
                <div className="overflow-hidden rounded-2xl border border-[var(--app-line)]">
                  <DataTable
                    rows={drill.rows}
                    rowKey={drill.rowKey}
                    columns={drill.columns}
                    onRowClick={drill.onRowClick}
                    pagination
                  />
                </div>
              ) : (
                <EmptyState icon={PackageCheck} title="Nothing to list" description="No records sit behind this figure yet." />
              )}
            </div>
            <ModalFooter>
              <ExportExcelButton module={drill.title} rows={drill.rows} columns={drill.exportColumns} />
              <Button variant="outline" onClick={() => setDrill(null)}>Close</Button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
      {modalOpen && (
        <MasterRecordModal
          title="Add store"
          note="Create an approved storeroom for material stock and purchase requests."
          fields={storeFieldsFor(siteOptions)}
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

