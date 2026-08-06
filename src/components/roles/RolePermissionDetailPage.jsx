import { useState } from 'react'
import { Activity, Building2, Check, FileText, Globe, Minus, Power, PowerOff, ShieldCheck, UserCog, Users } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { DetailHeader, DetailTabs, InfoCard, MetricCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import { permissionActions, permissionModules } from '../../config/runtimeDefaults'
import Field from '../ui/Field'
import Surface, { SurfaceHeader } from '../ui/Surface'
import TablePanel from '../ui/TablePanel'
import { dataScopeLabel, roleDataScopeOptions } from '../../lib/dataScope'
import useModuleAccess from '../../hooks/useModuleAccess'

const checkClass = active => `mx-auto grid h-6 w-6 place-items-center rounded-lg border text-[10px] font-extrabold ${active ? 'border-[var(--app-primary)] bg-[var(--app-badge-green-bg)] text-[var(--app-badge-green-text)]' : 'border-[var(--app-line)] text-[var(--app-muted)]'}`
const isAllActionsSelected = (role, module) => permissionActions.every(action => role.permissions?.[action]?.includes(module))
const moduleLabel = module => module === 'Work Order Workflow' ? 'Workflow Controls' : module

export default function RolePermissionDetailPage({ role, siteOptions = [], departmentOptions = [], onBack, onUpdate }) {
  const access = useModuleAccess('Roles & Permissions')
  const [tab, setTab] = useState('Scope Rules')
  const roleInactive = role.status === 'Inactive'
  const disabled = roleInactive || !access.edit
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
          actions={access.edit ? (
            <Button variant={roleInactive ? 'primary' : 'outline'} onClick={() => updateStatus(roleInactive ? 'Active' : 'Inactive')}>
              {roleInactive ? <Power size={15} /> : <PowerOff size={15} />}
              {roleInactive ? 'Activate role' : 'Disable role'}
            </Button>
          ) : null}
          stats={[
            { label: 'User / Group', value: role.user },
            { label: 'Data Visibility', value: dataScopeLabel(role.dataScope) },
            { label: 'Site / Department', value: 'Assigned per user' },
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
                { icon: Building2, label: 'Data Visibility', value: dataScopeLabel(role.dataScope), note: 'Transaction boundary' },
                { icon: ShieldCheck, label: 'Site / Department', value: 'Per user', note: 'Configured on each account' }
              ].map(metric => <MetricCard key={metric.label} {...metric} />)}
            </section>

            <InfoCard
              icon={ShieldCheck}
              kicker="ACCESS"
              title="Permission Scope"
              items={[
                ['Role', role.role],
                ['User / Group', role.user],
                ['Data Visibility', dataScopeLabel(role.dataScope)],
                ['Site / Department Scope', 'Configured on each user account'],
                ['Allowed Access', role.scope],
                ['Status', role.status]
              ]}
            />
            <Surface tone="purple">
              <SurfaceHeader eyebrow="Scope defaults" title="Transaction Visibility" description="The role controls how far users can see. Site and department assignments stay on each user account." />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Status" icon={Activity} value={role.status || 'Draft'} options={['Draft', 'Active', 'Inactive']} onChange={event => updateStatus(event.target.value)} disabled={!access.edit} />
                <Field label="Data Visibility" icon={Globe} value={role.dataScope || 'DEPARTMENT'} options={roleDataScopeOptions} onChange={updateField('dataScope')} disabled={disabled} />
                <div className="md:col-span-2">
                  <Field label="Allowed Access" icon={FileText} value={role.scope || ''} onChange={updateField('scope')} disabled={disabled} placeholder="Describe the purpose of this role" />
                </div>
              </div>
            </Surface>
          </main>
        )}

        {tab === 'Permission Matrix' && (
          <TablePanel>
            <SurfaceHeader eyebrow="Permission matrix" title="Module action access" description={disabled ? 'This role is inactive. Activate it before changing permissions.' : 'Control route, tab, and action access for this role. Work Order Planning controls the Work Order Plan tab.'} />
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
                            className="mx-auto flex items-center justify-center gap-2 rounded-lg px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-[var(--app-table-heading)] transition hover:bg-[var(--app-soft-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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
                          title={`Select all actions for ${moduleLabel(module)}`}
                        >
                          <span>{moduleLabel(module)}</span>
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
          </TablePanel>
        )}
      </div>

      <GenericPrintReport
        reportTitle="Role Permission Report"
        reportSubtitle="Permission scope and module action access"
        number={role.role}
        status={role.status}
        description={role.scope}
        summary={[['User / Group', role.user], ['Data Visibility', dataScopeLabel(role.dataScope)], ['Site / Department', 'Assigned per user']]}
        sections={[
          { title: 'Scope Rules', rows: [[['Role', role.role], ['User / Group', role.user], ['Data Visibility', dataScopeLabel(role.dataScope)], ['Site / Department', 'Assigned per user']]] },
          { title: 'Permission Summary', rows: permissionActions.map(action => ([['Action', action], ['Modules', (role.permissions?.[action] || []).join(', ') || '-'], ['Count', role.permissions?.[action]?.length || 0], ['Status', role.status]])) }
        ]}
      />
    </section>
  )
}

