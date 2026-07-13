import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import laborSeed from '../data/labor.json'
import AddLaborModal from '../components/labor/AddLaborModal'
import LaborDetailPage from '../components/labor/LaborDetailPage'
import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import MasterSummary from '../components/ui/MasterSummary'
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
  const routeId = decodeURIComponent(window.location.pathname.split('/labor/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.personId === routeId) || null)

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
        actionLabel="Add labor"
        actionIcon={Plus}
        onAction={() => setAdding(true)}
      />

      <MasterSummary
        icon={Users}
        label="Labor resources"
        value={rows.length}
        detail={`Available ${rows.filter(row => row.availability === 'Available').length}`}
      />

      <section className="panel register">
        <DataTable
          rows={rows}
          rowKey="personId"
          onRowClick={open}
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
