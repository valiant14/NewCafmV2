import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'

const modules = ['Job Requests', 'Work Orders', 'PM', 'Assets', 'Inventory', 'Incidents', 'Reports']
const actions = ['view', 'create', 'edit', 'approve', 'close', 'import']

const permissionRows = [
  { role: 'Facility Manager', user: 'Ahmed Faisal', site: 'All Sites', department: 'All Departments', scope: 'Full CMMS access', status: 'Active', permissions: { view: modules, create: modules, edit: modules, approve: modules, close: modules, import: modules } },
  { role: 'HVAC Supervisor', user: 'HVAC Lead', site: 'Riyadh / 1031', department: 'HVAC', scope: 'Manage HVAC work orders and PM schedules', status: 'Active', permissions: { view: ['Work Orders', 'PM', 'Assets', 'Inventory', 'Reports'], create: ['Work Orders', 'PM'], edit: ['Work Orders', 'PM'], approve: ['Work Orders'], close: ['Work Orders'], import: ['PM'] } },
  { role: 'Civil Technician', user: 'Civil Team', site: 'Riyadh / 1031', department: 'Civil', scope: 'View assigned work orders and enter actuals', status: 'Draft', permissions: { view: ['Work Orders', 'Assets'], create: [], edit: ['Work Orders'], approve: [], close: [], import: [] } }
]

const headers = ['role', 'user', 'site', 'department', 'scope', 'status', ...actions]
const cardClass = 'rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]'
const matrixClass = 'overflow-auto rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_8px_24px_rgba(32,55,45,.05)]'
const checkClass = active => `mx-auto grid h-6 w-6 place-items-center rounded-lg border text-[10px] font-extrabold ${active ? 'border-[var(--app-primary)] bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : 'border-[var(--app-line)] text-[var(--app-muted)]'}`

export default function RolesPermissionsPage() {
  const [tab, setTab] = useState('All')
  const [rows, setRows] = useState(permissionRows)
  const [filters, setFilters] = useState(emptyStandardFilters)
  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, { site: ['site'], department: ['department'], status: ['status'] })

  const togglePermission = (role, action, module) => {
    setRows(current => current.map(row => {
      if (row.role !== role) return row
      const currentModules = row.permissions[action] || []
      const nextModules = currentModules.includes(module)
        ? currentModules.filter(item => item !== module)
        : [...currentModules, module]
      return { ...row, permissions: { ...row.permissions, [action]: nextModules } }
    }))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Roles & Permissions"
        description="Configure site, department, and action-level access for the next security phase."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={headers} fileName="Roles_Permissions_Template.xlsx" />
            <ExcelImportButton label="Import Excel" onImport={importedRows => setRows(importedRows.map(row => ({ ...row, permissions: row.permissions || {} })))} />
          </div>
        )}
      />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Roles', count: rows.length },
          { key: 'Active', label: 'Active', count: rows.filter(row => row.status === 'Active').length },
          { key: 'Draft', label: 'Draft', count: rows.filter(row => row.status === 'Draft').length }
        ]}
      />

      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <section className={cardClass}>
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]"><ShieldCheck size={20} /></span>
          <div>
            <h3 className="text-lg font-extrabold text-[var(--app-ink)]">Permission scope rules</h3>
            <p className="text-sm text-[var(--app-muted)]">Minimum client requirement is enforced by defining access per site and department, then selecting allowed actions per module.</p>
          </div>
        </div>
        <DataTable
          rows={visibleRows}
          rowKey={row => `${row.role}-${row.department}`}
          pagination
          columns={[
            { key: 'role', label: 'Role' },
            { key: 'user', label: 'User / Group' },
            { key: 'site', label: 'Site Scope' },
            { key: 'department', label: 'Department Scope' },
            { key: 'scope', label: 'Allowed Access' },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </section>

      <section className={matrixClass}>
        <header className="border-b border-[var(--app-line)] p-4">
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">Permission Matrix</p>
          <h3 className="text-lg font-extrabold text-[var(--app-ink)]">Module action access</h3>
        </header>
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--app-table-header-bg)] text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-table-heading)]">
              <th className="border-b border-[var(--app-line)] p-3 text-left">Role</th>
              <th className="border-b border-[var(--app-line)] p-3 text-left">Module</th>
              {actions.map(action => <th key={action} className="border-b border-[var(--app-line)] p-3 text-center">{action}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleRows.flatMap(row => modules.map(module => (
              <tr key={`${row.role}-${module}`} className="border-b border-[var(--app-line)] last:border-b-0">
                <td className="p-3 font-bold text-[var(--app-ink)]">{row.role}</td>
                <td className="p-3 text-[var(--app-muted)]">{module}</td>
                {actions.map(action => {
                  const active = row.permissions?.[action]?.includes(module)
                  return (
                    <td key={action} className="p-3 text-center">
                      <button type="button" className={checkClass(active)} onClick={() => togglePermission(row.role, action, module)}>{active ? '✓' : '—'}</button>
                    </td>
                  )
                })}
              </tr>
            )))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
