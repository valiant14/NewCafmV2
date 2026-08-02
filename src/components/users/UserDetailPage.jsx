import { useState } from 'react'
import { BriefcaseBusiness, Building2, ShieldCheck, UserRound, Users } from 'lucide-react'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import Field from '../ui/Field'

const userStatuses = ['Active', 'Inactive', 'Locked']
const toneByStatus = { Active: 'green', Inactive: 'orange', Locked: 'orange' }
const maskPassword = password => password ? '•'.repeat(Math.min(12, Math.max(6, String(password).length))) : 'Not set'

export default function UserDetailPage({ user, role, labor, onBack, onUpdate }) {
  const [tab, setTab] = useState('User Details')
  const changeStatus = event => onUpdate?.(user.userId, { status: event.target.value })
  const updateField = key => event => onUpdate?.(user.userId, { [key]: event.target.value })
  const permissionRows = Object.entries(role?.permissions || {}).map(([action, modules]) => ({
    action,
    modules: modules.join(', ') || '-',
    count: modules.length
  }))

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="USER ACCOUNT"
          id={user.username}
          title={user.name}
          status={user.status}
          statusTone={toneByStatus[user.status] || 'green'}
          onBack={onBack}
          backLabel="Back to users"
          stats={[
            { label: 'Role', value: user.role },
            { label: 'Site', value: user.site },
            { label: 'Department', value: user.department },
            { label: 'Linked Labor', value: user.laborId || 'Not linked' }
          ]}
          actions={(
            <select
              value={user.status}
              onChange={changeStatus}
              className="h-10 min-w-[150px] rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
              aria-label="Change user status"
            >
              {userStatuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          )}
        />

        <DetailTabs tabs={['User Details', 'Role Permissions', 'Labor Link']} active={tab} onChange={setTab} />

        {tab === 'User Details' && (
          <main className="space-y-4">
            <section className="grid gap-3 md:grid-cols-4">
              {[
                { icon: UserRound, label: 'Account', value: user.username, note: user.email },
                { icon: ShieldCheck, label: 'Role', value: user.role, note: role?.status || 'No role' },
                { icon: Building2, label: 'Scope', value: user.site, note: user.department },
                { icon: BriefcaseBusiness, label: 'Labor', value: user.laborId || '-', note: labor?.craft || 'No labor link' }
              ].map(metric => {
                const Icon = metric.icon
                return (
                  <div key={metric.label} className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">{metric.label}</span>
                      <Icon size={16} className="text-[var(--app-primary)]" />
                    </div>
                    <strong className="mt-2 block truncate text-xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">{metric.value}</strong>
                    <small className="block truncate text-[11px] font-semibold text-[var(--app-muted)]">{metric.note}</small>
                  </div>
                )
              })}
            </section>

            <InfoCard
              icon={UserRound}
              kicker="ACCOUNT"
              title="User Information"
              items={[
                ['User ID', user.userId],
                ['Username', user.username],
                ['Password', maskPassword(user.password)],
                ['Name', user.name],
                ['Email', user.email],
                ['Status', user.status],
                ['Last Login', user.lastLogin]
              ]}
            />
            <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
              <header className="mb-4 border-b border-[var(--app-line)] pb-4">
                <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">ACCESS SCOPE</span>
                <h2 className="text-base font-extrabold text-[var(--app-ink)]">User Site Access</h2>
              </header>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Site Scope" value={user.site || ''} onChange={updateField('site')} placeholder="All Sites or 1031, 1032" />
                <Field label="Department Scope" value={user.department || ''} onChange={updateField('department')} placeholder="All Departments or HVAC" />
              </div>
            </section>
          </main>
        )}

        {tab === 'Role Permissions' && (
          <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-table-bg)] shadow-[0_8px_24px_rgba(32,55,45,.06)]">
            {role ? (
              <DataTable
                rows={permissionRows}
                rowKey="action"
                pagination
                columns={[
                  { key: 'action', label: 'Action', render: value => <strong className="capitalize text-[var(--app-ink)]">{value}</strong> },
                  { key: 'modules', label: 'Allowed Modules' },
                  { key: 'count', label: 'Module Count' }
                ]}
              />
            ) : (
              <EmptyState icon={ShieldCheck} title="No role assigned" description="Assign a valid role to show permission scope." />
            )}
          </section>
        )}

        {tab === 'Labor Link' && (
          <section className="grid gap-4 lg:grid-cols-2">
            <InfoCard
              icon={Users}
              kicker="LINKED LABOR"
              title={labor ? labor.name : 'No labor linked'}
              items={[
                ['Labor ID', user.laborId || '-'],
                ['Name', labor?.name],
                ['Craft Code', labor?.craftCode],
                ['Craft', labor?.craft],
                ['Department', labor?.department],
                ['Availability', labor?.availability]
              ]}
            />
            <InfoCard
              icon={ShieldCheck}
              kicker="ROLE SCOPE"
              title={role?.role || user.role}
              items={[
                ['Site Scope', role?.site || user.site],
                ['Department Scope', role?.department || user.department],
                ['Allowed Access', role?.scope],
                ['Role Status', role?.status]
              ]}
            />
          </section>
        )}
      </div>

      <GenericPrintReport
        reportTitle="User Account Report"
        reportSubtitle="User, role, and labor linkage"
        number={user.username}
        status={user.status}
        description={user.name}
        summary={[['Role', user.role], ['Site', user.site], ['Department', user.department]]}
        sections={[
          { title: 'User Information', rows: [[['User ID', user.userId], ['Username', user.username], ['Name', user.name], ['Email', user.email]]] },
          { title: 'Access Linkage', rows: [[['Role', user.role], ['Labor ID', user.laborId || '-'], ['Site', user.site], ['Department', user.department]]] }
        ]}
      />
    </section>
  )
}
