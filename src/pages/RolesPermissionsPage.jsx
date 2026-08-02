import { useState } from 'react'
import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import RolePermissionDetailPage from '../components/roles/RolePermissionDetailPage'
import StandardFilters from '../components/ui/StandardFilters'
import { permissionActions, rolePermissionRows } from '../data/workspaceData'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'

const headers = ['role', 'user', 'site', 'department', 'scope', 'status', ...permissionActions]

export default function RolesPermissionsPage({ rows = rolePermissionRows, setRows }) {
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const routeId = decodeURIComponent(window.location.pathname.split('/roles-permissions/')[1] || '')
  const [selectedRole, setSelectedRole] = useState(rows.find(row => row.role === routeId) || null)
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

  if (selectedRole) {
    return <RolePermissionDetailPage role={selectedRole} onBack={close} onUpdate={updateRole} />
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
            <ExcelImportButton label="Import Excel" onImport={importedRows => setRows?.(importedRows.map(row => ({ ...row, permissions: row.permissions || {} })))} />
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

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_8px_24px_rgba(32,55,45,.05)]">
        <DataTable
          rows={visibleRows}
          rowKey={row => `${row.role}-${row.department}`}
          onRowClick={open}
          pagination
          columns={[
            { key: 'role', label: 'Role', render: value => <strong className="text-[var(--app-ink)]">{value}</strong> },
            { key: 'user', label: 'User / Group' },
            { key: 'site', label: 'Site Scope' },
            { key: 'department', label: 'Department Scope' },
            { key: 'scope', label: 'Allowed Access' },
            { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> }
          ]}
        />
      </section>
    </div>
  )
}
