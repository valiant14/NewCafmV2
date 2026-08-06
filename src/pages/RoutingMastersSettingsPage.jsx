import { useMemo, useState } from 'react'
import { Activity, Building2, FileText, Hash, Network, Plus, Users, UserRoundCheck, Workflow } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import TablePanel from '../components/ui/TablePanel'
import useModuleAccess from '../hooks/useModuleAccess'
import { mergeImportedRows } from '../lib/importRows'
import { sameDepartment } from '../lib/departments'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { pick } from '../services/importRows'

const SYSTEMS = 'Systems'
const WORK_GROUPS = 'Work Groups'

const emptySystem = {
  code: '',
  name: '',
  description: '',
  site: '',
  department: '',
  subDepartment: '',
  status: 'Active'
}

const emptyWorkGroup = {
  code: '',
  name: '',
  site: '',
  department: '',
  subDepartment: '',
  supervisorId: '',
  status: 'Active'
}

const scopeSection = {
  section: 'Scope',
  sectionIcon: Building2,
  sectionNote: 'Where this routing record can be selected',
  sectionTone: 'green'
}

const identitySection = {
  section: 'Identity',
  sectionIcon: Hash,
  sectionNote: 'Stable code and readable name used throughout maintenance records'
}

const optionRows = rows => ['', ...rows]

const fieldOptions = ({ form, sites, departments, labor, type }) => {
  const siteChoices = sites
    .filter(row => row.status !== 'Inactive')
    .map(row => ({ value: row.code, label: row.name }))
  const departmentChoices = [...new Set(departments
    .filter(row => row.status !== 'Inactive' && row.department)
    .map(row => row.department))]
    .sort()
  const subDepartmentChoices = departments
    .filter(row => row.status !== 'Inactive' && (!form.department || sameDepartment(row.department, form.department)))
    .map(row => ({ value: row.subDepartmentCode, label: row.description }))
  const supervisorChoices = labor
    .filter(person => String(person.status || 'Active').toLowerCase() !== 'inactive')
    .filter(person => !form.site || person.site === form.site)
    .filter(person => !form.department || sameDepartment(person.department, form.department))
    .filter(person => !form.subDepartment || !person.subDepartment || person.subDepartment === form.subDepartment)
    .map(person => ({ value: person.personId, label: `${person.name}${person.craft ? ` / ${person.craft}` : ''}` }))

  const common = [
    { ...identitySection, key: 'code', label: type === SYSTEMS ? 'System Code' : 'Work Group Code', icon: Hash, required: true, placeholder: type === SYSTEMS ? 'SYS-HVAC' : 'WG-CIVIL-01' },
    { ...identitySection, key: 'name', label: type === SYSTEMS ? 'System Name' : 'Work Group Name', icon: type === SYSTEMS ? Workflow : Users, required: true, placeholder: type === SYSTEMS ? 'HVAC' : 'Civil Response Team' },
    { ...scopeSection, key: 'site', label: 'Site', icon: Building2, required: true, options: optionRows(siteChoices) },
    { ...scopeSection, key: 'department', label: 'Department', icon: Users, required: true, options: optionRows(departmentChoices) },
    { ...scopeSection, key: 'subDepartment', label: 'Sub Department', icon: Network, options: optionRows(subDepartmentChoices) },
    { ...scopeSection, key: 'status', label: 'Status', icon: Activity, options: ['Active', 'Inactive'] }
  ]

  if (type === SYSTEMS) {
    common.splice(2, 0, { ...identitySection, key: 'description', label: 'Description', icon: FileText, type: 'textarea', fullWidth: true, placeholder: 'What equipment or service this system represents' })
    return common
  }

  common.push({
    section: 'Leadership',
    sectionIcon: UserRoundCheck,
    sectionNote: 'The supervisor selected automatically when this group is assigned',
    sectionTone: 'purple',
    sectionSpan: 'full',
    key: 'supervisorId',
    label: 'Default Supervisor',
    icon: UserRoundCheck,
    options: optionRows(supervisorChoices)
  })
  return common
}

const supervisorName = (row, labor) => labor.find(person => person.personId === row.supervisorId)?.name || ''

export default function RoutingMastersSettingsPage({
  systems = [],
  setSystems,
  workGroups = [],
  setWorkGroups,
  sites = [],
  departments = [],
  labor = []
}) {
  const access = useModuleAccess('Routing Masters')
  const [type, setType] = useState(SYSTEMS)
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState('')
  const [form, setForm] = useState(emptySystem)
  const [error, setError] = useState('')
  const rows = type === SYSTEMS ? systems : workGroups
  const setRows = type === SYSTEMS ? setSystems : setWorkGroups
  const empty = type === SYSTEMS ? emptySystem : emptyWorkGroup
  const visibleRows = applyStandardFilters(rows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status']
  })

  const fields = useMemo(() => fieldOptions({ form, sites, departments, labor, type }), [form, sites, departments, labor, type])

  const changeType = value => {
    setType(value)
    setFilters(emptyStandardFilters)
    setImported('')
    setModalOpen(false)
    setEditing('')
    setForm(value === SYSTEMS ? emptySystem : emptyWorkGroup)
  }

  const updateForm = update => setForm(current => {
    const next = typeof update === 'function' ? update(current) : update
    if (next.site !== current.site) return { ...next, department: '', subDepartment: '', supervisorId: '' }
    if (next.department !== current.department) return { ...next, subDepartment: '', supervisorId: '' }
    if (next.subDepartment !== current.subDepartment) return { ...next, supervisorId: '' }
    return next
  })

  const openNew = () => {
    setEditing('')
    setForm({ ...empty })
    setError('')
    setModalOpen(true)
  }

  const openEdit = row => {
    setEditing(row.code)
    setForm({ ...empty, ...row })
    setError('')
    setModalOpen(true)
  }

  const save = async () => {
    const code = String(form.code || '').trim()
    const name = String(form.name || '').trim()
    if (!code || !name || !form.site || !form.department) return
    if (rows.some(row => row.code === code && row.code !== editing)) {
      setError(`${type === SYSTEMS ? 'System' : 'Work group'} code already exists.`)
      return
    }
    const record = { ...form, code, name }
    const result = await setRows?.(current => editing
      ? current.map(row => row.code === editing ? record : row)
      : [record, ...current]
    )
    if (!result?.__saveError) setModalOpen(false)
  }

  const normalizeImportRows = importedRows => importedRows.map(row => {
    const supervisorValue = pick(row, ['supervisorId', 'Supervisor ID', 'Default Supervisor'])
    const supervisor = labor.find(person => person.personId === supervisorValue || person.name === supervisorValue)
    return {
      ...empty,
      code: String(pick(row, ['code', type === SYSTEMS ? 'System Code' : 'Work Group Code'])).trim(),
      name: pick(row, ['name', type === SYSTEMS ? 'System Name' : 'Work Group Name']),
      description: type === SYSTEMS ? pick(row, ['description', 'Description']) : undefined,
      site: String(pick(row, ['site', 'Site', 'Site Code'])).trim(),
      department: pick(row, ['department', 'Department']),
      subDepartment: pick(row, ['subDepartment', 'Sub Department', 'Sub Department Code']),
      supervisorId: type === WORK_GROUPS ? (supervisor?.personId || supervisorValue || '') : undefined,
      status: pick(row, ['status', 'Status'], 'Active')
    }
  }).filter(row => row.code && row.name && row.site && row.department)

  const importRows = async importedRows => {
    const normalized = normalizeImportRows(importedRows)
    await setRows?.(current => mergeImportedRows(current, normalized, 'code'))
  }

  const templateHeaders = type === SYSTEMS
    ? ['System Code', 'System Name', 'Description', 'Site Code', 'Department', 'Sub Department Code', 'Status']
    : ['Work Group Code', 'Work Group Name', 'Site Code', 'Department', 'Sub Department Code', 'Supervisor ID', 'Status']
  const exportColumns = type === SYSTEMS
    ? [
        { key: 'code', header: 'System Code' },
        { key: 'name', header: 'System Name' },
        { key: 'description', header: 'Description' },
        { key: 'site', header: 'Site Code' },
        { key: 'department', header: 'Department' },
        { key: 'subDepartment', header: 'Sub Department Code' },
        { key: 'status', header: 'Status' }
      ]
    : [
        { key: 'code', header: 'Work Group Code' },
        { key: 'name', header: 'Work Group Name' },
        { key: 'site', header: 'Site Code' },
        { key: 'department', header: 'Department' },
        { key: 'subDepartment', header: 'Sub Department Code' },
        { key: 'supervisorId', header: 'Supervisor ID' },
        { key: 'status', header: 'Status' }
      ]

  return (
    <>
      <PageHeader
        eyebrow="SETTINGS"
        title="Routing Masters"
        description="Control the systems, work groups, and default supervisors used by Assets and Work Orders."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName={`${type.replaceAll(' ', '_')}_Template.xlsx`} />
            <ExportExcelButton module="Routing Masters" rows={visibleRows} columns={exportColumns} />
            {access.import && <ExcelImportButton fileName={imported} onFile={setImported} onImport={importRows} />}
            {access.create && <Button onClick={openNew}><Plus size={17} />Add {type === SYSTEMS ? 'system' : 'work group'}</Button>}
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject={type.toLowerCase()} onClear={() => setImported('')} />

      <IndexTabs
        active={type}
        onChange={changeType}
        tabs={[
          { key: SYSTEMS, label: 'Systems', count: systems.length },
          { key: WORK_GROUPS, label: 'Work Groups', count: workGroups.length }
        ]}
      />

      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <TablePanel tone={type === SYSTEMS ? 'green' : 'purple'}>
        <DataTable
          rows={visibleRows}
          rowKey="code"
          onRowClick={access.edit ? openEdit : undefined}
          pagination
          columns={type === SYSTEMS ? [
            { key: 'code', label: 'System Code', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
            { key: 'name', label: 'System Name' },
            { key: 'description', label: 'Description', render: value => value || '-' },
            { key: 'site', label: 'Site' },
            { key: 'department', label: 'Department' },
            { key: 'subDepartment', label: 'Sub Department', render: value => value || 'All' },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> }
          ] : [
            { key: 'code', label: 'Work Group Code', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
            { key: 'name', label: 'Work Group Name' },
            { key: 'site', label: 'Site' },
            { key: 'department', label: 'Department' },
            { key: 'subDepartment', label: 'Sub Department', render: value => value || 'All' },
            { key: 'supervisorId', label: 'Default Supervisor', render: (_, row) => supervisorName(row, labor) || '-' },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </TablePanel>

      {modalOpen && (
        <MasterRecordModal
          title={`${editing ? 'Edit' : 'Add'} ${type === SYSTEMS ? 'system' : 'work group'}`}
          note={type === SYSTEMS
            ? 'Systems are filtered by the selected Work Order site and department.'
            : 'Work Groups control routing and can automatically select a default supervisor.'}
          fields={fields}
          form={form}
          setForm={updateForm}
          error={error}
          submitLabel={editing ? `Save ${type === SYSTEMS ? 'system' : 'work group'}` : `Create ${type === SYSTEMS ? 'system' : 'work group'}`}
          onClose={() => setModalOpen(false)}
          onSave={save}
        />
      )}
    </>
  )
}
