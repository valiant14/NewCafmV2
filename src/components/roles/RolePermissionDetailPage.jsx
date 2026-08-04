import { useState } from 'react'
import { Building2, Check, Minus, Power, PowerOff, ShieldCheck, UserCog, Users } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import { permissionActions, permissionModules } from '../../config/runtimeDefaults'
import Field from '../ui/Field'

const matrixClass = 'overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_8px_24px_rgba(32,55,45,.05)]'
const checkClass = active => `mx-auto grid h-6 w-6 place-items-center rounded-lg border text-[10px] font-extrabold ${active ? 'border-[var(--app-primary)] bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : 'border-[var(--app-line)] text-[var(--app-muted)]'}`
const isAllActionsSelected = (role, module) => permissionActions.every(action => role.permissions?.[action]?.includes(module))

export default function RolePermissionDetailPage({ role, siteOptions = [], departmentOptions = [], onBack, onUpdate }) {
  const [tab, setTab] = useState('Scope Rules')
  const disabled = role.status === 'Inactive'
  const updateField = key => event => onUpdate?.(role.role, { [key]: event.target.value })
  const updateStatus = status => onUpdate?.(role.role, { status })
  const updatePermissions = permissions => {
    if (disabled) return
    onUpdate?.(role.role, { permissions })
  }
  const togglePermission = (action, module) => {
    if (disabled) return
    const currentModules = [...new Set(role.permissions?.[action] || [])]
    const nextModules = currentModules.includes(module)
      ? currentModules.filter(item => item !== module)
      : [...currentModules, module]
    updatePermissions({ ...role.permissions, [action]: nextModules })
  }
  const toggleAction = action => {
    if (disabled) return
    const currentModules = [...new Set(role.permissions?.[action] || [])]
    const allSelected = permissionModules.every(module => currentModules.includes(module))
    updatePermissions({ ...role.permissions, [action]: allSelected ? [] : permissionModules })
  }
  const toggleModule = module => {
    if (disabled) return
    const allSelected = isAllActionsSelected(role, module)
    const permissions = Object.fromEntries(permissionActions.map(action => {
      const currentModules = [...new Set(role.permissions?.[action] || [])]
      return [
        action,
        allSelected
          ? currentModules.filter(item => item !== module)
          : [...new Set([...currentModules, module])]
      ]
    }))
    updatePermissions({ ...role.permissions, ...permissions })
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
          actions={(
            <Button variant={disabled ? 'primary' : 'outline'} onClick={() => updateStatus(disabled ? 'Active' : 'Inactive')}>
              {disabled ? <Power size={15} /> : <PowerOff size={15} />}
              {disabled ? 'Activate role' : 'Disable role'}
            </Button>
          )}
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
            <section className="rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_12px_32px_rgba(15,23,42,.06)]">
              <header className="mb-4 border-b border-[var(--app-line)] pb-4">
                <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">SCOPE DEFAULTS</span>
                <h2 className="text-base font-extrabold text-[var(--app-ink)]">Role Site Access</h2>
              </header>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Status" value={role.status || 'Draft'} options={['Draft', 'Active', 'Inactive']} onChange={event => updateStatus(event.target.value)} />
                <Field label="Allowed Access" value={role.scope || ''} onChange={updateField('scope')} disabled={disabled} placeholder="Describe the purpose of this role" />
                <Field label="Site Scope" value={role.site || ''} onChange={updateField('site')} suggestions={siteOptions} disabled={disabled} placeholder="All Sites or Riyadh / 1031, Jeddah / 1032" />
                <Field label="Department Scope" value={role.department || ''} onChange={updateField('department')} suggestions={departmentOptions} disabled={disabled} placeholder="All Departments or HVAC, Civil" />
              </div>
            </section>
          </main>
        )}

        {tab === 'Permission Matrix' && (
          <section className={matrixClass}>
            <header className="border-b border-[var(--app-line)] p-4">
              <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">Permission Matrix</p>
              <h3 className="text-lg font-extrabold text-[var(--app-ink)]">Module action access</h3>
              <p className="mt-1 text-xs text-[var(--app-muted)]">{disabled ? 'This role is inactive. Activate it before changing permissions.' : 'Control route, tab, and action access for this role. For example, Work Order Planning controls the WO Plan tab.'}</p>
            </header>
            <div className="overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--app-table-header-bg)] text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-table-heading)]">
                    <th className="border-b border-[var(--app-line)] p-3 text-left">Module</th>
                    {permissionActions.map(action => {
                      const active = permissionModules.every(module => role.permissions?.[action]?.includes(module))
                      return (
                        <th key={action} className="border-b border-[var(--app-line)] p-3 text-center">
                          <button
                            type="button"
                            className="mx-auto flex items-center justify-center gap-2 rounded-xl px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-table-heading)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => toggleAction(action)}
                            disabled={disabled}
                            title={`Select all ${action} permissions`}
                          >
                            <span>{action}</span>
                            <span className={checkClass(active)}>{active ? <Check size={12} /> : <Minus size={12} />}</span>
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {permissionModules.map(module => (
                    <tr key={`${role.role}-${module}`} className="border-b border-[var(--app-line)] last:border-b-0">
                      <td className="p-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-left font-bold text-[var(--app-ink)] transition hover:bg-[var(--app-table-header-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => toggleModule(module)}
                          disabled={disabled}
                          title={`Select all actions for ${module}`}
                        >
                          <span>{module}</span>
                          <span className={checkClass(isAllActionsSelected(role, module))}>{isAllActionsSelected(role, module) ? <Check size={12} /> : <Minus size={12} />}</span>
                        </button>
                      </td>
                      {permissionActions.map(action => {
                        const active = role.permissions?.[action]?.includes(module)
                        return (
                          <td key={action} className="p-3 text-center">
                            <button type="button" className={checkClass(active)} onClick={() => togglePermission(action, module)} disabled={disabled}>{active ? <Check size={12} /> : <Minus size={12} />}</button>
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

