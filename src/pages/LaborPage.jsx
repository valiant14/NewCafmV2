import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
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
import TablePanel from '../components/ui/TablePanel'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { mergeImportedRows } from '../lib/importRows'
import useModuleAccess from '../hooks/useModuleAccess'

const empty = {
  personId: '',
  name: '',
  craftCode: '',
  craft: '',
  site: '',
  department: '',
  subDepartment: '',
  workGroup: '',
  shift: 'Day',
  availability: 'Available'
}
const templateHeaders = Object.keys(empty)
const workOrderNumber = order => String(order.WORKORDER || order['WORK ORDER'] || order.workOrder || '')
const workOrderTitle = order => order['DESCRIPITION '] || order.DESCRIPTION || order.description || 'Work order'
const workOrderDepartment = order => String(order['DEPARTMENT '] || order.department || '')
const workOrderSubDepartment = order => String(order['SUB DEPARTMENT  NAME'] || order.subDepartment || '')
const laborPastWork = (labor, workOrders) => workOrders
  .filter(order => {
    return workOrderDepartment(order) === labor.department
      || workOrderSubDepartment(order) === labor.subDepartment
  })
  .slice(0, 8)
  .map((order, index) => ({
    reference: workOrderNumber(order) || `${labor.personId}-WO-${index + 1}`,
    description: workOrderTitle(order),
    status: order.STATUS || 'COMP',
    workType: String(order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim(),
    department: workOrderDepartment(order) || labor.department,
    site: order.SITE || '',
    targetFinish: order['TARGET FINISH '] || order['TARGET START '] || '-'
  }))

const laborRouting = (labor, workGroups, laborRows) => {
  const group = workGroups.find(row => row.code === labor?.workGroup)
  const supervisor = laborRows.find(row => row.personId === group?.supervisorId)
  return {
    workGroupName: group ? `${group.code} / ${group.name}` : '',
    supervisorName: supervisor ? `${supervisor.name} / ${supervisor.personId}` : ''
  }
}

export default function LaborPage({ rows = [], setRows, workOrders = [], siteRecords = [], departmentRecords = [], workGroupRecords = [] }) {
  const access = useModuleAccess('Labor')
  const [adding, setAdding] = useState(false)
  const [editingPersonId, setEditingPersonId] = useState('')
  const [form, setForm] = useState(empty)
  const [imported, setImported] = useState('')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const routeId = decodeURIComponent(window.location.pathname.split('/labor/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.personId === routeId) || null)
  useEffect(() => {
    if (!routeId) {
      setSelected(null)
      return
    }
    setSelected(rows.find(row => row.personId === routeId) || null)
  }, [rows, routeId])
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
    setRows?.(current => current.map(row => row.personId === personId ? { ...row, ...patch } : row))
    setSelected(current => current?.personId === personId ? { ...current, ...patch } : current)
  }

  const beginAdd = () => {
    setEditingPersonId('')
    setForm(empty)
    setAdding(true)
  }

  const beginEdit = () => {
    if (!selected) return
    setEditingPersonId(selected.personId)
    setForm({ ...empty, ...selected })
    setAdding(true)
  }

  const closeModal = () => {
    setAdding(false)
    setEditingPersonId('')
    setForm(empty)
  }

  const save = async () => {
    if (!form.personId || !form.name || !form.craftCode || !form.site || !form.department) return
    const { teamSupervisor: _teamSupervisor, ...record } = form
    const result = await setRows?.(current => editingPersonId
      ? current.map(row => row.personId === editingPersonId ? record : row)
      : [...current, record]
    )
    if (result?.__saveError) return
    closeModal()
    if (editingPersonId) setSelected(record)
    else open(record)
  }

  const laborModal = adding && (
    <AddLaborModal
      form={form}
      setForm={setForm}
      siteRecords={siteRecords}
      departmentRecords={departmentRecords}
      workGroupRecords={workGroupRecords}
      laborRows={rows}
      lockPersonId={Boolean(editingPersonId)}
      title={editingPersonId ? 'Edit labor resource' : 'Add labor resource'}
      note="Assign site, department, and Work Group membership for controlled Work Order planning."
      submitLabel={editingPersonId ? 'Save labor' : 'Create labor'}
      onClose={closeModal}
      onSave={save}
    />
  )

  if (selected) {
    const routing = laborRouting(selected, workGroupRecords, rows)
    return (
      <>
        <LaborDetailPage labor={selected} workGroupName={routing.workGroupName} supervisorName={routing.supervisorName} pastWork={laborPastWork(selected, workOrders)} onBack={close} onUpdate={updateLabor} onEdit={access.edit ? beginEdit : undefined} />
        {laborModal}
      </>
    )
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
            {access.import && <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setRows(current => mergeImportedRows(current, rows, 'personId'))} />}
            {access.create && <Button onClick={beginAdd}><Plus size={17} />Add labor</Button>}
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

      <TablePanel>
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
            { key: 'site', label: 'Site' },
            { key: 'department', label: 'Department' },
            { key: 'subDepartment', label: 'Sub Department' },
            { key: 'workGroup', label: 'Work Group', render: (_, row) => laborRouting(row, workGroupRecords, rows).workGroupName || '-' },
            { key: 'supervisor', label: 'Supervisor', render: (_, row) => laborRouting(row, workGroupRecords, rows).supervisorName || '-' },
            { key: 'shift', label: 'Shift' },
            { key: 'availability', label: 'Availability', render: value => <Badge tone={value === 'Available' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </TablePanel>

      {laborModal}
    </>
  )
}

