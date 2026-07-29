import { useState } from 'react'
import { Plus } from 'lucide-react'
import materialSeed from '../data/materials.json'
import { workOrders } from '../data/cafmData'
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
import { availabilityFor, storeLabel, storesHolding, totalAvailable, totalBalance, totalReserved } from '../lib/inventory'

const empty = {
  itemNumber: '',
  description: '',
  category: '',
  unit: 'EA',
  storeroom: 'DIWAN-MAIN',
  balance: 0,
  reserved: 0,
  reorderLevel: 0,
  availability: 'Available'
}
const templateHeaders = Object.keys(empty)

// Balances now live per store, so the register shows the roll-up across all of them.
const withStock = row => ({
  ...row,
  balance: totalBalance(row.itemNumber) || Number(row.balance) || 0,
  reserved: totalReserved(row.itemNumber) || Number(row.reserved) || 0,
  available: totalAvailable(row.itemNumber),
  stores: storesHolding(row.itemNumber).map(storeLabel).join(', ') || row.storeroom || '',
  availability: availabilityFor(row)
})

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
  { key: 'availability', label: 'Availability' }
]
const materialUsageMap = {
  'MAT-0001': [
    { workOrder: 'PM-ALS-HV-00001-2026-01', quantity: 4, type: 'PM', status: 'COMP' },
    { workOrder: 'PM-MS-MEC-FCU-001-2026-01', quantity: 2, type: 'PM', status: 'CLOSE' }
  ],
  'MAT-0002': [
    { workOrder: '56545132', quantity: 1, type: 'CM', status: 'INPRG' }
  ],
  'MAT-0003': [
    { workOrder: 'PM-MS-MEC-SAU-001-2026-01', quantity: 3, type: 'PM', status: 'COMP' }
  ],
  'MAT-0004': [
    { workOrder: '56545132', quantity: 6, type: 'CM', status: 'APPR' }
  ],
  'MAT-0005': [
    { workOrder: 'PM-MS-MEC-FDA-001-2026-01', quantity: 8, type: 'PM', status: 'WAPPR' }
  ],
  'MAT-0006': [
    { workOrder: 'PMKG-L00-19-2026-01', quantity: 5, type: 'PM', status: 'CLOSE' }
  ]
}

const findWorkOrder = reference => workOrders.find(order => String(order.WORKORDER || order['WORK ORDER']) === String(reference))
const materialUsage = material => (materialUsageMap[material.itemNumber] || []).map((usage, index) => {
  const order = findWorkOrder(usage.workOrder)
  return {
    reference: usage.workOrder,
    description: order?.['DESCRIPITION '] || order?.DESCRIPTION || `${material.description} usage`,
    workType: usage.type,
    quantity: usage.quantity,
    unit: material.unit,
    status: order?.STATUS || usage.status,
    site: order?.SITE || '1031',
    department: order?.['DEPARTMENT '] || material.category,
    source: index === 0 ? 'Actual consumption' : 'Planned / reserved'
  }
})

export default function MaterialsPage() {
  const [rows, setRows] = useState(materialSeed)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const routeId = decodeURIComponent(window.location.pathname.split('/materials/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.itemNumber === routeId) || null)
  const stockedRows = rows.map(withStock)
  const tabRows = tab === 'All' ? stockedRows : stockedRows.filter(row => row.availability === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, {
    site: ['site', 'storeroom'],
    department: ['department', 'category'],
    status: ['availability'],
    date: ['updatedDate']
  })

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/materials/${row.itemNumber}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/materials')
  }

  const updateMaterial = (itemNumber, patch) => {
    setRows(current => current.map(row => row.itemNumber === itemNumber ? { ...row, ...patch } : row))
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
    setRows(current => [...current, row])
    setAdding(false)
    setForm(empty)
    open(row)
  }

  if (selected) {
    return <MaterialDetailPage material={selected} usageRows={materialUsage(selected)} onBack={close} onUpdate={updateMaterial} />
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
            { key: 'availability', label: 'Availability', render: value => <Badge tone={value === 'Available' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </section>

      {adding && <AddMaterialModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}
