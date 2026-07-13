import { useState } from 'react'
import { Plus } from 'lucide-react'
import laborSeed from '../data/labor.json'
import AddLaborModal from '../components/labor/AddLaborModal'
import LaborDetailPage from '../components/labor/LaborDetailPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'

const empty = {
  personId: '',
  name: '',
  craftCode: '',
  craft: '',
  department: '',
  subDepartment: '',
  shift: 'Day',
  availability: 'Available'
}

export default function LaborPage() {
  const [rows, setRows] = useState(laborSeed)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const routeId = decodeURIComponent(window.location.pathname.split('/labor/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.personId === routeId) || null)
  const visibleRows = tab === 'All' ? rows : rows.filter(row => row.availability === tab)

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/labor/${row.personId}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/labor')
  }

  const save = () => {
    if (!form.personId || !form.name || !form.craftCode) return
    setRows(current => [...current, form])
    setAdding(false)
    setForm(empty)
    open(form)
  }

  if (selected) {
    return <LaborDetailPage labor={selected} onBack={close} />
  }

  return (
    <>
      <PageHeader
        eyebrow="RESOURCE MASTER DATA"
        title="Labor"
        description="Maintain technicians, craft codes, departments, shifts, and availability."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelImportButton fileName={imported} onFile={setImported} />
            <Button onClick={() => setAdding(true)}><Plus size={17} />Add labor</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="labor" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'All', label: 'All Labor', count: rows.length },
          { key: 'Available', label: 'Available', count: rows.filter(row => row.availability === 'Available').length },
          { key: 'Assigned', label: 'Assigned', count: rows.filter(row => row.availability === 'Assigned').length },
          { key: 'On Leave', label: 'On Leave', count: rows.filter(row => row.availability === 'On Leave').length }
        ]}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable
          rows={visibleRows}
          rowKey="personId"
          onRowClick={open}
          pagination
          columns={[
            { key: 'personId', label: 'Person ID', render: value => <strong className="mono">{value}</strong> },
            { key: 'name', label: 'Name' },
            { key: 'craftCode', label: 'Craft code' },
            { key: 'craft', label: 'Craft' },
            { key: 'department', label: 'Department' },
            { key: 'subDepartment', label: 'Sub Department' },
            { key: 'shift', label: 'Shift' },
            { key: 'availability', label: 'Availability', render: value => <Badge tone={value === 'Available' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </section>

      {adding && <AddLaborModal form={form} setForm={setForm} onClose={() => setAdding(false)} onSave={save} />}
    </>
  )
}
