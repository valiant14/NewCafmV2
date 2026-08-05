import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import TablePanel from '../components/ui/TablePanel'
import RolePermissionDetailPage from '../components/roles/RolePermissionDetailPage'
import StandardFilters from '../components/ui/StandardFilters'
import Field from '../components/ui/Field'
import { ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '../components/ui/ModalFrame'
import { permissionActions, rolePermissionRows } from '../config/runtimeDefaults'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { dataScopeLabel, roleDataScopeOptions } from '../lib/dataScope'
import { mergeImportedRows } from '../lib/importRows'
import useModuleAccess from '../hooks/useModuleAccess'

const headers = ['role', 'dataScope', 'scope', 'status', ...permissionActions]
const permissionText = value => Array.isArray(value) ? value.join(', ') : String(value || '')
const parsePermissionText = value => permissionText(value).split(/[,;|]+/).map(item => item.trim()).filter(Boolean)
const roleFromImport = row => ({
  ...row,
  dataScope: row.dataScope || 'DEPARTMENT',
  permissions: Object.fromEntries(permissionActions.map(action => [action, parsePermissionText(row[action] || row.permissions?.[action])]))
})
const exportColumns = [
  ...['role', 'dataScope', 'scope', 'status'].map(header => ({ key: header, label: header })),
  ...permissionActions.map(action => ({ key: action, label: action, exportValue: (_, row) => permissionText(row.permissions?.[action]) }))
]
const blankRole = () => ({
  role: '',
  user: '',
  site: 'All Sites',
  department: 'All Departments',
  dataScope: 'DEPARTMENT',
  scope: '',
  status: 'Draft',
  permissions: Object.fromEntries(permissionActions.map(action => [action, []]))
})

export default function RolesPermissionsPage({ rows = rolePermissionRows, setRows, siteOptions = [], departmentOptions = [] }) {
  const access = useModuleAccess('Roles & Permissions')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [imported, setImported] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(blankRole)
  const [formError, setFormError] = useState('')
  const routeId = decodeURIComponent(window.location.pathname.split('/roles-permissions/')[1] || '')
  const [selectedRole, setSelectedRole] = useState(rows.find(row => row.role === routeId) || null)
  useEffect(() => {
    if (!routeId) {
      setSelectedRole(null)
      return
    }
    setSelectedRole(rows.find(row => row.role === routeId) || null)
  }, [rows, routeId])
  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, { site: ['site'], department: ['department'], status: ['status'] })

  const open = row => {
    setSelectedRole(row)
    window.history.pushState({}, '', `/roles-permissions/${encodeURIComponent(row.role)}`)
  }

  const close = () => {
    setSelectedRole(null)
    window.history.pushState({}, '', '/roles-permissions')
  }

  const updateRole = (roleName, patch) => {
    setRows?.(current => current.map(row => row.role === roleName ? { ...row, ...patch } : row))
    setSelectedRole(current => current?.role === roleName ? { ...current, ...patch } : current)
  }
  const createRole = async () => {
    const roleName = form.role.trim()
    if (!roleName) return setFormError('Role name is required.')
    if (rows.some(row => row.role.toLowerCase() === roleName.toLowerCase())) return setFormError('Role already exists.')
    const created = { ...blankRole(), ...form, role: roleName, status: form.status || 'Draft' }
    await setRows?.(current => [created, ...current])
    setCreating(false)
    setForm(blankRole())
    setFormError('')
    setSelectedRole(created)
    window.history.pushState({}, '', `/roles-permissions/${encodeURIComponent(created.role)}`)
  }

  if (selectedRole) {
    return <RolePermissionDetailPage role={selectedRole} siteOptions={siteOptions} departmentOptions={departmentOptions} onBack={close} onUpdate={updateRole} />
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Roles & Permissions"
        description="Manage role scope rules. Open a role to configure its permission matrix."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={headers} fileName="Roles_Permissions_Template.xlsx" />
            <ExportExcelButton module="Roles Permissions" rows={visibleRows} columns={exportColumns} />
            {access.import && <ExcelImportButton label="Import Excel" fileName={imported} onFile={setImported} onImport={importedRows => setRows?.(current => mergeImportedRows(current, importedRows.map(roleFromImport), 'role'))} />}
            {access.create && <Button onClick={() => { setForm(blankRole()); setFormError(''); setCreating(true) }}><Plus size={15} />Add role</Button>}
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="roles and permissions" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Roles', count: rows.length },
          { key: 'Active', label: 'Active', count: rows.filter(row => row.status === 'Active').length },
          { key: 'Draft', label: 'Draft', count: rows.filter(row => row.status === 'Draft').length },
          { key: 'Inactive', label: 'Inactive', count: rows.filter(row => row.status === 'Inactive').length }
        ]}
      />

      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <TablePanel>
        <DataTable
          rows={visibleRows}
          rowKey={row => `${row.role}-${row.department}`}
          onRowClick={open}
          pagination
          columns={[
            { key: 'role', label: 'Role', render: value => <strong className="text-[var(--app-ink)]">{value}</strong> },
            { key: 'dataScope', label: 'Data Visibility', render: value => dataScopeLabel(value) },
            { key: 'scope', label: 'Allowed Access' },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </TablePanel>
      {creating && (
        <ModalOverlay>
          <ModalPanel className="max-w-3xl" labelledBy="new-role-title">
            <ModalHeader
              eyebrow="ADMINISTRATION"
              title="Add role"
              titleId="new-role-title"
              description="Create a role first, then configure its permission matrix."
              onClose={() => setCreating(false)}
            />
            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              {formError && <Alert className="md:col-span-2" tone="danger">{formError}</Alert>}
              <Field label="Role name" value={form.role} required onChange={event => setForm({ ...form, role: event.target.value })} placeholder="Civil Supervisor" />
              <Field label="Status" value={form.status} options={['Draft', 'Active', 'Inactive']} onChange={event => setForm({ ...form, status: event.target.value })} />
              <Field label="Data Visibility" value={form.dataScope} options={roleDataScopeOptions} onChange={event => setForm({ ...form, dataScope: event.target.value })} />
              <div className="md:col-span-2"><Field label="Allowed Access" value={form.scope} onChange={event => setForm({ ...form, scope: event.target.value })} placeholder="Describe the purpose of this role" /></div>
            </div>
            <ModalFooter>
              <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              <Button onClick={createRole}><Plus size={15} />Create role</Button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
