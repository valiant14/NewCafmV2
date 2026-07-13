import { useState } from 'react'
import { Plus } from 'lucide-react'
import toolSeed from '../data/tools.json'
import AddToolModal from '../components/tools/AddToolModal'
import ToolDetailPage from '../components/tools/ToolDetailPage'
import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
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
  const [tab, setTab] = useState('All')
  const routeId = decodeURIComponent(window.location.pathname.split('/tools/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.toolNumber === routeId) || null)
  const visibleRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)

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

      <IndexTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'All', label: 'All Tools', count: rows.length },
          { key: 'Available', label: 'Available', count: rows.filter(row => row.status === 'Available').length },
          { key: 'Allocated', label: 'Allocated', count: rows.filter(row => row.status === 'Allocated').length },
          { key: 'Maintenance', label: 'Maintenance', count: rows.filter(row => row.status === 'Maintenance').length }
        ]}
      />

      <section className="panel register">
        <DataTable
          rows={visibleRows}
          rowKey="toolNumber"
          onRowClick={open}
          pagination
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
