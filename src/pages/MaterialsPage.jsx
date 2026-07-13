import { useState } from 'react'
import { Plus } from 'lucide-react'
import materialSeed from '../data/materials.json'
import AddMaterialModal from '../components/materials/AddMaterialModal'
import MaterialDetailPage from '../components/materials/MaterialDetailPage'
import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import MasterSummary from '../components/ui/MasterSummary'
import PageHeader from '../components/ui/PageHeader'

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

export default function MaterialsPage() {
  const [rows, setRows] = useState(materialSeed)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const routeId = decodeURIComponent(window.location.pathname.split('/materials/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.itemNumber === routeId) || null)

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/materials/${row.itemNumber}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/materials')
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
    return <MaterialDetailPage material={selected} onBack={close} />
  }

  return (
    <>
      <PageHeader
        eyebrow="INVENTORY MASTER DATA"
        title="Materials"
        description="Maintain spare parts, consumables, balances, reservations, and reorder levels."
        actions={(
          <div className="heading-actions">
            <ExcelImportButton fileName={imported} onFile={setImported} />
            <button className="primary" onClick={() => setAdding(true)}><Plus size={17} />Add material</button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="inventory" onClear={() => setImported('')} />

      <MasterSummary
        icon={PackageCheck}
        label="Inventory items"
        value={rows.length}
        detail={`Purchase required ${rows.filter(row => row.availability === 'Purchase Required').length}`}
      />

      <section className="panel register">
        <DataTable
          rows={rows}
          rowKey="itemNumber"
          onRowClick={open}
          columns={[
            { key: 'itemNumber', label: 'Item number', render: value => <strong className="mono">{value}</strong> },
            { key: 'description', label: 'Description' },
            { key: 'category', label: 'Category' },
            { key: 'unit', label: 'Unit' },
            { key: 'storeroom', label: 'Storeroom' },
            { key: 'balance', label: 'Balance' },
            { key: 'reserved', label: 'Reserved' },
            { key: 'reorderLevel', label: 'Reorder level' },
            { key: 'availability', label: 'Availability', render: value => <Badge tone={value === 'Available' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </section>

      {adding && <AddMaterialModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}
