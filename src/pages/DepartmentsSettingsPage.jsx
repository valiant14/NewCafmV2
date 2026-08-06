import { useState } from 'react'
import { Activity, FileText, Hash, Layers, Plus, Users } from 'lucide-react'
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
import TablePanel from '../components/ui/TablePanel'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import useModuleAccess from '../hooks/useModuleAccess'
import { pick } from '../services/importRows'
import { mergeImportedRows } from '../lib/importRows'

const emptyDepartment = {
  subDepartmentCode: '',
  department: '',
  description: '',
  status: 'Active'
}

const parent = { section: 'Department', sectionIcon: Users, sectionNote: 'The department this line sits under - it is what a user scope is set to' }
const line = { section: 'Sub department', sectionIcon: Layers, sectionNote: 'The coded line itself, as it appears on work orders', sectionTone: 'green' }

const fields = [
  { ...parent, key: 'department', label: 'Department', icon: Users, required: true, placeholder: 'Mechanical' },
  { ...parent, key: 'status', label: 'Status', icon: Activity, options: ['Active', 'Inactive'] },
  { ...line, key: 'subDepartmentCode', label: 'Sub Department Code', icon: Hash, required: true, placeholder: '4-1-1' },
  { ...line, key: 'description', label: 'Description', icon: FileText, required: true, placeholder: 'Mechanical-HVAC' }
]
const templateHeaders = ['Sub Department Code', 'Department', 'Description']
const exportColumns = [
  { key: 'subDepartmentCode', header: 'Sub Department Code' },
  { key: 'department', header: 'Department' },
  { key: 'description', header: 'Description' },
  { key: 'status', header: 'Status' }
]

export default function DepartmentsSettingsPage({ rows = [], setRows }) {
  const access = useModuleAccess('Departments')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyDepartment)
  const [error, setError] = useState('')
  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, {
    department: ['department'],
    status: ['status']
  })

  const openNew = () => {
    setEditing(null)
    setForm(emptyDepartment)
    setError('')
    setModalOpen(true)
  }

  const openEdit = row => {
    setEditing(row.subDepartmentCode)
    setForm({ ...emptyDepartment, ...row })
    setError('')
    setModalOpen(true)
  }

  const save = () => {
    const subDepartmentCode = String(form.subDepartmentCode || '').trim()
    if (!subDepartmentCode || !form.department || !form.description) return
    const duplicate = rows.some(row => row.subDepartmentCode === subDepartmentCode && row.subDepartmentCode !== editing)
    if (duplicate) return setError('Sub department code already exists.')
    const record = { ...form, subDepartmentCode }
    setRows?.(current => editing
      ? current.map(row => row.subDepartmentCode === editing ? record : row)
      : [record, ...current]
    )
    setModalOpen(false)
  }

  const normalizeImportRows = importedRows => importedRows.map(row => ({
      ...emptyDepartment,
      ...row,
      subDepartmentCode: String(pick(row, ['subDepartmentCode', 'Sub Department Code', 'code'])).trim(),
      department: pick(row, ['department', 'Department']),
      description: pick(row, ['description', 'Description', 'name']),
      status: pick(row, ['status', 'Status'], 'Active')
    })).filter(row => row.subDepartmentCode && row.department && row.description)

  const importRows = async importedRows => {
    const normalized = normalizeImportRows(importedRows)
    await setRows?.(current => mergeImportedRows(current, normalized, 'subDepartmentCode'))
  }

  return (
    <>
      <PageHeader
        eyebrow="SETTINGS"
        title="Departments"
        description="Maintain department and sub-department records used for user access scope."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Departments_Template.xlsx" />
            <ExportExcelButton module="Departments" rows={visibleRows} columns={exportColumns} />
            {access.import && <ExcelImportButton fileName={imported} onFile={setImported} onImport={importRows} />}
            {access.create && <Button onClick={openNew}><Plus size={17} />Add department</Button>}
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="departments" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Departments', count: rows.length },
          { key: 'Active', label: 'Active', count: rows.filter(row => row.status === 'Active').length },
          { key: 'Inactive', label: 'Inactive', count: rows.filter(row => row.status === 'Inactive').length }
        ]}
      />

      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={[]}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <TablePanel tone="purple">
        <DataTable
          rows={visibleRows}
          rowKey="subDepartmentCode"
          onRowClick={openEdit}
          pagination
          columns={[
            { key: 'subDepartmentCode', label: 'Sub Department Code', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
            { key: 'department', label: 'Department', render: value => <Badge tone="purple">{value || '-'}</Badge> },
            { key: 'description', label: 'Description' },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </TablePanel>
      {modalOpen && (
        <MasterRecordModal
          title={editing ? 'Edit department' : 'Add department'}
          note="Use the same columns as the department import template."
          fields={fields}
          form={form}
          setForm={setForm}
          error={error}
          submitLabel={editing ? 'Save department' : 'Create department'}
          onClose={() => setModalOpen(false)}
          onSave={save}
        />
      )}
    </>
  )
}
