import { useState } from 'react'
import { Plus } from 'lucide-react'
import laborSeed from '../data/labor.json'
import { laborWorkMap } from '../data/laborWorkMap'
import { workOrders } from '../data/cafmData'
import AddLaborModal from '../components/labor/AddLaborModal'
import LaborDetailPage from '../components/labor/LaborDetailPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'

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
const templateHeaders = Object.keys(empty)
const workOrderNumber = order => String(order.WORKORDER || order['WORK ORDER'] || order.workOrder || '')
const workOrderTitle = order => order['DESCRIPITION '] || order.DESCRIPTION || order.description || 'Work order'
const workOrderDepartment = order => String(order['DEPARTMENT '] || order.department || '')
const workOrderSubDepartment = order => String(order['SUB DEPARTMENT  NAME'] || order.subDepartment || '')
const laborPastWork = labor => workOrders
  .filter(order => {
    const assignedNumbers = laborWorkMap[labor.personId] || []
    const number = workOrderNumber(order)
    return assignedNumbers.includes(number)
      || workOrderDepartment(order) === labor.department
      || workOrderSubDepartment(order) === labor.subDepartment
  })
  .slice(0, 8)
  .map((order, index) => ({
    reference: workOrderNumber(order) || `${labor.personId}-WO-${index + 1}`,
    description: workOrderTitle(order),
    status: order.STATUS || 'COMP',
    workType: String(order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim(),
    department: workOrderDepartment(order) || labor.department,
    site: order.SITE || '1031',
    targetFinish: order['TARGET FINISH '] || order['TARGET START '] || '-'
  }))

export default function LaborPage() {
  const [rows, setRows] = useState(laborSeed)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const routeId = decodeURIComponent(window.location.pathname.split('/labor/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.personId === routeId) || null)
  const tabRows = tab === 'All' ? rows : rows.filter(row => row.availability === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['availability'],
    date: ['createdDate']
  })

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/labor/${row.personId}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/labor')
  }

  const updateLabor = (personId, patch) => {
    setRows(current => current.map(row => row.personId === personId ? { ...row, ...patch } : row))
    setSelected(current => current?.personId === personId ? { ...current, ...patch } : current)
  }

  const save = () => {
    if (!form.personId || !form.name || !form.craftCode) return
    setRows(current => [...current, form])
    setAdding(false)
    setForm(empty)
    open(form)
  }

  if (selected) {
    return <LaborDetailPage labor={selected} pastWork={laborPastWork(selected)} onBack={close} onUpdate={updateLabor} />
  }

  return (
    <>
      <PageHeader
        eyebrow="RESOURCE MASTER DATA"
        title="Labor"
        description="Maintain technicians, craft codes, departments, shifts, and availability."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Labor_Template.xlsx" />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setRows(rows)} />
            <Button onClick={() => setAdding(true)}><Plus size={17} />Add labor</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="labor" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Labor', count: rows.length },
          { key: 'Available', label: 'Available', count: rows.filter(row => row.availability === 'Available').length },
          { key: 'Assigned', label: 'Assigned', count: rows.filter(row => row.availability === 'Assigned').length },
          { key: 'On Leave', label: 'On Leave', count: rows.filter(row => row.availability === 'On Leave').length }
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={optionsFromRows(rows, ['availability'])}
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
