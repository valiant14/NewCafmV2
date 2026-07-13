import { useState } from 'react'
import { Plus, Wrench } from 'lucide-react'
import toolSeed from '../data/tools.json'
import AddToolModal from '../components/tools/AddToolModal'
import ToolDetailPage from '../components/tools/ToolDetailPage'
import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import MasterSummary from '../components/ui/MasterSummary'
import PageHeader from '../components/ui/PageHeader'

const empty = {
  toolNumber: '',
  description: '',
  category: '',
  location: '',
  quantity: 1,
  status: 'Available',
  inspectionDue: ''
}

export default function ToolsPage() {
  const [rows, setRows] = useState(toolSeed)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const routeId = decodeURIComponent(window.location.pathname.split('/tools/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.toolNumber === routeId) || null)

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/tools/${row.toolNumber}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/tools')
  }

  const save = () => {
    if (!form.toolNumber || !form.description) return
    const row = { ...form, quantity: Number(form.quantity) }
    setRows(current => [...current, row])
    setAdding(false)
    setForm(empty)
    open(row)
  }

  if (selected) {
    return <ToolDetailPage tool={selected} onBack={close} />
  }

  return (
    <>
      <PageHeader
        eyebrow="RESOURCE MASTER DATA"
        title="Tools & Equipment"
        description="Maintain tools, equipment locations, quantities, status, and inspections."
        actions={(
          <div className="heading-actions">
            <ExcelImportButton fileName={imported} onFile={setImported} />
            <button className="primary" onClick={() => setAdding(true)}><Plus size={17} />Add tool or equipment</button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="tools and equipment" onClear={() => setImported('')} />

      <MasterSummary
        icon={Wrench}
        label="Tools and equipment"
        value={rows.length}
        detail={`Available ${rows.filter(row => row.status === 'Available').length}`}
      />

      <section className="panel register">
        <DataTable
          rows={rows}
          rowKey="toolNumber"
          onRowClick={open}
          columns={[
            { key: 'toolNumber', label: 'Tool number', render: value => <strong className="mono">{value}</strong> },
            { key: 'description', label: 'Description' },
            { key: 'category', label: 'Category' },
            { key: 'location', label: 'Location' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Available' ? 'green' : 'orange'}>{value}</Badge> },
            { key: 'inspectionDue', label: 'Inspection due' }
          ]}
        />
      </section>

      {adding && <AddToolModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}
