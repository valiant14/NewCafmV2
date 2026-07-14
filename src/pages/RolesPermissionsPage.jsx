import { useState } from 'react'
import { ShieldCheck, UserCog } from 'lucide-react'
import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'

const permissionRows = [
  { role: 'Facility Manager', user: 'Ahmed Faisal', site: 'All Sites', department: 'All Departments', scope: 'Full CMMS access', status: 'Active' },
  { role: 'HVAC Supervisor', user: 'HVAC Lead', site: 'Riyadh / 1031', department: 'HVAC', scope: 'Manage HVAC work orders and PM schedules', status: 'Active' },
  { role: 'Civil Technician', user: 'Civil Team', site: 'Riyadh / 1031', department: 'Civil', scope: 'View assigned work orders and enter actuals', status: 'Draft' }
]

const headers = ['role', 'user', 'site', 'department', 'scope', 'status']

export default function RolesPermissionsPage() {
  const [tab, setTab] = useState('All')
  const rows = tab === 'All' ? permissionRows : permissionRows.filter(row => row.status === tab)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Roles & Permissions"
        description="Configure simple access rules by site and department for the next development phase."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={headers} fileName="Roles_Permissions_Template.xlsx" />
            <ExcelImportButton label="Import Excel" />
          </div>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-[var(--app-line)] bg-white p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
          <ShieldCheck className="mb-3 text-[var(--app-primary)]" size={22} />
          <strong className="block text-sm text-[var(--app-ink)]">Minimum permission rule</strong>
          <p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">Users are scoped by Site and Department, matching the client example for HVAC in Riyadh.</p>
        </article>
        <article className="rounded-2xl border border-[var(--app-line)] bg-white p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
          <UserCog className="mb-3 text-[var(--app-primary)]" size={22} />
          <strong className="block text-sm text-[var(--app-ink)]">Phase-ready interface</strong>
          <p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">The matrix can be expanded after final workflows and approval levels are confirmed.</p>
        </article>
        <article className="rounded-2xl border border-[var(--app-line)] bg-white p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
          <strong className="block text-2xl font-extrabold text-[var(--app-ink)]">{permissionRows.length}</strong>
          <span className="text-xs text-[var(--app-muted)]">Mock permission profiles available for testing</span>
        </article>
      </div>

      <IndexTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'All', label: 'All Roles', count: permissionRows.length },
          { key: 'Active', label: 'Active', count: permissionRows.filter(row => row.status === 'Active').length },
          { key: 'Draft', label: 'Draft', count: permissionRows.filter(row => row.status === 'Draft').length }
        ]}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        <DataTable
          rows={rows}
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
    </div>
  )
}
