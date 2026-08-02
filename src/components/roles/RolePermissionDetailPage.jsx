import { useState } from 'react'
import { Building2, ShieldCheck, UserCog, Users } from 'lucide-react'
import Badge from '../ui/Badge'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import { permissionActions, permissionModules } from '../../data/workspaceData'

const matrixClass = 'overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_8px_24px_rgba(32,55,45,.05)]'
const checkClass = active => `mx-auto grid h-6 w-6 place-items-center rounded-lg border text-[10px] font-extrabold ${active ? 'border-[var(--app-primary)] bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : 'border-[var(--app-line)] text-[var(--app-muted)]'}`

export default function RolePermissionDetailPage({ role, onBack, onUpdate }) {
  const [tab, setTab] = useState('Scope Rules')
  const togglePermission = (action, module) => {
    const currentModules = role.permissions?.[action] || []
    const nextModules = currentModules.includes(module)
      ? currentModules.filter(item => item !== module)
      : [...currentModules, module]
    onUpdate?.(role.role, { permissions: { ...role.permissions, [action]: nextModules } })
  }

  const permissionCount = permissionActions.reduce((sum, action) => sum + (role.permissions?.[action]?.length || 0), 0)

  return (
    <section className="printable-record">
      <div className="print-report-screen space-y-5">
        <DetailHeader
          eyebrow="PERMISSION SCOPE RULES"
          id={role.role}
          title={role.scope}
          status={role.status}
          statusTone={role.status === 'Active' ? 'green' : 'orange'}
          onBack={onBack}
          backLabel="Back to roles"
          stats={[
            { label: 'User / Group', value: role.user },
            { label: 'Site Scope', value: role.site },
            { label: 'Department Scope', value: role.department },
            { label: 'Permissions', value: permissionCount }
          ]}
        />

        <DetailTabs tabs={['Scope Rules', 'Permission Matrix']} active={tab} onChange={setTab} />

        {tab === 'Scope Rules' && (
          <main className="space-y-4">
            <section className="grid gap-3 md:grid-cols-4">
              {[
                { icon: UserCog, label: 'Role', value: role.role, note: role.status },
                { icon: Users, label: 'User / Group', value: role.user, note: 'Assigned principal' },
                { icon: Building2, label: 'Site', value: role.site, note: 'Access boundary' },
                { icon: ShieldCheck, label: 'Department', value: role.department, note: 'Permission scope' }
              ].map(metric => {
                const Icon = metric.icon
                return (
                  <div key={metric.label} className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">{metric.label}</span>
                      <Icon size={16} className="text-[var(--app-primary)]" />
                    </div>
                    <strong className="mt-2 block truncate text-xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">{metric.value}</strong>
                    <small className="text-[11px] font-semibold text-[var(--app-muted)]">{metric.note}</small>
                  </div>
                )
              })}
            </section>

            <InfoCard
              icon={ShieldCheck}
              kicker="ACCESS"
              title="Permission Scope"
              items={[
                ['Role', role.role],
                ['User / Group', role.user],
                ['Site Scope', role.site],
                ['Department Scope', role.department],
                ['Allowed Access', role.scope],
                ['Status', role.status]
              ]}
            />
          </main>
        )}

        {tab === 'Permission Matrix' && (
          <section className={matrixClass}>
            <header className="border-b border-[var(--app-line)] p-4">
              <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">Permission Matrix</p>
              <h3 className="text-lg font-extrabold text-[var(--app-ink)]">Module action access</h3>
              <p className="mt-1 text-xs text-[var(--app-muted)]">Editing this role only. Return to the role list to select a different permission scope.</p>
            </header>
            <div className="overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--app-table-header-bg)] text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-table-heading)]">
                    <th className="border-b border-[var(--app-line)] p-3 text-left">Module</th>
                    {permissionActions.map(action => <th key={action} className="border-b border-[var(--app-line)] p-3 text-center">{action}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {permissionModules.map(module => (
                    <tr key={`${role.role}-${module}`} className="border-b border-[var(--app-line)] last:border-b-0">
                      <td className="p-3 font-bold text-[var(--app-ink)]">{module}</td>
                      {permissionActions.map(action => {
                        const active = role.permissions?.[action]?.includes(module)
                        return (
                          <td key={action} className="p-3 text-center">
                            <button type="button" className={checkClass(active)} onClick={() => togglePermission(action, module)}>{active ? '✓' : '—'}</button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <GenericPrintReport
        reportTitle="Role Permission Report"
        reportSubtitle="Permission scope and module action access"
        number={role.role}
        status={role.status}
        description={role.scope}
        summary={[['User / Group', role.user], ['Site', role.site], ['Department', role.department]]}
        sections={[
          { title: 'Scope Rules', rows: [[['Role', role.role], ['User / Group', role.user], ['Site Scope', role.site], ['Department Scope', role.department]]] },
          { title: 'Permission Summary', rows: permissionActions.map(action => ([['Action', action], ['Modules', (role.permissions?.[action] || []).join(', ') || '-'], ['Count', role.permissions?.[action]?.length || 0], ['Status', role.status]])) }
        ]}
      />
    </section>
  )
}
