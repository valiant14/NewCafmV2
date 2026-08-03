import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import AddMaterialModal from '../components/materials/AddMaterialModal'
import MaterialDetailPage from '../components/materials/MaterialDetailPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { availabilityFor, materialStatusTone, stockForItem, storeLabel, storesHolding, totalAvailable, totalBalance, totalReserved } from '../lib/inventory'

const empty = {
  itemNumber: '',
  description: '',
  category: '',
  unit: 'EA',
  storeroom: 'DIWAN-MAIN',
  balance: 0,
  reserved: 0,
  reorderLevel: 0,
  availability: 'Available',
  status: 'Available'
}
const templateHeaders = Object.keys(empty)

// Balances now live per store, so the register shows the roll-up across all of them.
const withStock = (row, stockRows, storeRows) => {
  const itemStock = stockForItem(row.itemNumber, stockRows)
  const reorderLevel = Math.max(0, ...itemStock.map(stock => Number(stock.reorderLevel) || 0), Number(row.reorderLevel) || 0)
  const enriched = { ...row, reorderLevel }
  return {
    ...enriched,
    balance: totalBalance(row.itemNumber, stockRows) || Number(row.balance) || 0,
    reserved: totalReserved(row.itemNumber, stockRows) || Number(row.reserved) || 0,
    available: totalAvailable(row.itemNumber, stockRows),
    stores: storesHolding(row.itemNumber, stockRows).map(code => storeLabel(code, storeRows)).join(', ') || row.storeroom || '',
    availability: availabilityFor(enriched, stockRows)
  }
}

const exportColumns = [
  { key: 'itemNumber', label: 'Item Number' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'unit', label: 'Unit' },
  { key: 'stores', label: 'Stores' },
  { key: 'balance', label: 'Total Balance' },
  { key: 'reserved', label: 'Total Reserved' },
  { key: 'available', label: 'Available' },
  { key: 'reorderLevel', label: 'Reorder Level' },
  { key: 'availability', label: 'Availability' },
  { key: 'status', label: 'Material Status' }
]
const sameMaterial = (row, id) => String(row.itemNumber || '').trim().toLowerCase() === String(id || '').trim().toLowerCase()

const materialUsage = (material, workOrders) => workOrders.flatMap(order => {
  const resources = Array.isArray(order['PLANNED RESOURCES']) ? order['PLANNED RESOURCES'] : []
  return resources
    .filter(resource => resource.type === 'Material')
    .filter(resource => String(resource.itemCode || resource.item || '').trim() === String(material.itemNumber || material.description || '').trim() || String(resource.item || '').trim() === String(material.description || '').trim())
    .map((resource, index) => ({
      reference: `${order.WORKORDER}-${resource.transactionRef || resource.item || index}`,
      workOrder: order.WORKORDER,
      description: order?.['DESCRIPITION '] || order?.DESCRIPTION || `${material.description} usage`,
      workType: String(order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim(),
      quantity: resource.quantity || resource.requestedQuantity || 0,
      unit: material.unit,
      status: order?.STATUS || resource.requestStatus || '',
      site: order?.SITE || '',
      department: order?.['DEPARTMENT '] || '',
      source: resource.transactionRef || resource.supplyChainStatus || resource.requestStatus || 'Planned resource'
    }))
})

export default function MaterialsPage({ rows = [], setRows, stockRows = [], storeRows = [], workOrders = [] }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const routeId = decodeURIComponent(window.location.pathname.split('/materials/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => sameMaterial(row, routeId)) || null)
  const stockedRows = useMemo(() => rows.map(row => withStock(row, stockRows, storeRows)), [rows, stockRows, storeRows])
  const selectedMaterial = selected ? withStock(rows.find(row => sameMaterial(row, selected.itemNumber)) || selected, stockRows, storeRows) : null
  useEffect(() => {
    if (!routeId) {
      setSelected(null)
      return
    }
    const latest = rows.find(row => sameMaterial(row, routeId))
    if (latest) setSelected(latest)
  }, [rows, routeId])
  const tabRows = tab === 'All' ? stockedRows : stockedRows.filter(row => row.availability === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, {
    site: ['site', 'storeroom'],
    department: ['department', 'category'],
    status: ['availability'],
    date: ['updatedDate']
  })

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/materials/${encodeURIComponent(row.itemNumber)}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/materials')
  }

  const updateMaterial = (itemNumber, patch) => {
    setRows?.(current => current.map(row => row.itemNumber === itemNumber ? { ...row, ...patch } : row))
    setSelected(current => current?.itemNumber === itemNumber ? { ...current, ...patch } : current)
  }

  const save = () => {
    if (!form.itemNumber || !form.description) return
    const row = {
      ...form,
      balance: Number(form.balance),
      reserved: Number(form.reserved),
      reorderLevel: Number(form.reorderLevel)
    }
    setRows?.(current => [...current, row])
    setAdding(false)
    setForm(empty)
    open(row)
  }

  if (selectedMaterial) {
    return <MaterialDetailPage material={selectedMaterial} stockRows={stockRows} storeRows={storeRows} usageRows={materialUsage(selectedMaterial, workOrders)} onBack={close} onUpdate={updateMaterial} />
  }

  return (
    <>
      <PageHeader
        eyebrow="INVENTORY MASTER DATA"
        title="Materials"
        description="Maintain spare parts, consumables, balances, reservations, and reorder levels."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Materials_Template.xlsx" />
            <ExportExcelButton module="Materials" rows={visibleRows} columns={exportColumns} />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setRows(rows)} />
            <Button onClick={() => setAdding(true)}><Plus size={17} />Add material</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="inventory" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Materials', count: stockedRows.length },
          { key: 'Available', label: 'Available', count: stockedRows.filter(row => row.availability === 'Available').length },
          { key: 'Purchase Required', label: 'Purchase Required', count: stockedRows.filter(row => row.availability === 'Purchase Required').length }
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site', 'storeroom'])}
        departmentOptions={optionsFromRows(rows, ['department', 'category'])}
        statusOptions={optionsFromRows(rows, ['availability'])}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable
          rows={visibleRows}
          rowKey="itemNumber"
          onRowClick={open}
          pagination
          columns={[
            { key: 'itemNumber', label: 'Item number', render: value => <strong className="mono">{value}</strong> },
            { key: 'description', label: 'Description' },
            { key: 'category', label: 'Category' },
            { key: 'unit', label: 'Unit' },
            { key: 'stores', label: 'Stores' },
            { key: 'balance', label: 'Balance' },
            { key: 'reserved', label: 'Reserved' },
            { key: 'available', label: 'Available', render: (value, row) => <Badge tone={value > row.reorderLevel ? 'green' : 'orange'}>{value}</Badge> },
            { key: 'reorderLevel', label: 'Reorder level' },
            { key: 'availability', label: 'Availability', render: value => <Badge tone={value === 'Available' ? 'green' : 'orange'}>{value}</Badge> },
            { key: 'status', label: 'Material Status', render: value => value ? <Badge tone={materialStatusTone(value)}>{value}</Badge> : '—' }
          ]}
        />
      </section>

      {adding && <AddMaterialModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}
