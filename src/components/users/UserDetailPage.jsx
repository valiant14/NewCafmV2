import { useEffect, useState } from 'react'
import { BriefcaseBusiness, Building2, ShieldCheck, UserRound, Users } from 'lucide-react'
import Badge from '../ui/Badge'
import Combobox from '../ui/Combobox'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import Field from '../ui/Field'
import Surface, { SurfaceHeader } from '../ui/Surface'
import TablePanel from '../ui/TablePanel'
import { dataScopeLabel, userDataScopeOptions } from '../../lib/dataScope'
import useModuleAccess from '../../hooks/useModuleAccess'

const userStatuses = ['Active', 'Inactive', 'Locked']
const toneByStatus = { Active: 'green', Inactive: 'orange', Locked: 'orange' }
const everySite = value => !String(value || '').trim() || /^all sites$/i.test(String(value).trim())
const everyDepartment = value => !String(value || '').trim() || /^all departments$/i.test(String(value).trim())

// Keeps the summary tiles at their original size and weight while making the value itself
// the control, so the page reads the same but every tile is editable where it is shown.
const tileControl = 'mt-1.5 w-full truncate rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xl font-extrabold text-[var(--app-ink)] outline-none transition hover:border-[var(--app-line)] hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-field-focus)] focus:bg-[var(--app-panel)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]'

function AccessTile({ icon: Icon, label, note, children }) {
  return (
    <Surface as="div" className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">{label}</span>
        <Icon size={16} className="text-[var(--app-primary)]" />
      </div>
      {children}
      <small className="mt-1 block truncate text-[11px] font-semibold text-[var(--app-muted)]">{note}</small>
    </Surface>
  )
}

// Each keystroke would otherwise be its own save, so text edits are held locally and
// committed when the field is left or Enter is pressed.
function EditableField({ label, value = '', type, placeholder, clearOnCommit, onCommit, disabled = false }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  const commit = () => {
    if (draft === value) return
    onCommit(draft)
    if (clearOnCommit) setDraft('')
  }

  return (
    <Field
      label={label}
      value={draft}
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') event.target.blur()
        if (event.key === 'Escape') setDraft(value)
      }}
    />
  )
}

export default function UserDetailPage({ user, role, labor, roleOptions = [], siteOptions = [], departmentOptions = [], onBack, onUpdate }) {
  const access = useModuleAccess('Users')
  const [tab, setTab] = useState('User Details')
  const changeStatus = event => onUpdate?.(user.userId, { status: event.target.value })
  const updateField = key => event => onUpdate?.(user.userId, { [key]: event.target.value })
  const commitField = key => value => onUpdate?.(user.userId, { [key]: value })
  // The user's current role stays selectable even when it is missing from the role master,
  // so opening the page never silently reassigns them to whichever role sorts first.
  const roleChoices = [...new Set([user.role, ...roleOptions].filter(Boolean))]
  // Typing in the role box only filters the list - a user has to hold a role that exists,
  // so a half-typed name is never saved.
  const changeRole = event => {
    const picked = roleChoices.find(item => item.toLowerCase() === String(event.target.value).trim().toLowerCase())
    if (picked) onUpdate?.(user.userId, { role: picked })
  }
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
            { label: 'Data View', value: dataScopeLabel(user.dataScope) }
          ]}
          actions={access.edit ? (
            <div className="min-w-[150px]">
              <Combobox
                picker
                className="h-10 w-full rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-xs font-extrabold text-[var(--app-ink)] outline-none transition hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-primary)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]"
                value={user.status}
                suggestions={userStatuses}
                onChange={changeStatus}
                placeholder="Status"
              />
            </div>
          ) : null}
        />

        <DetailTabs tabs={['User Details', 'Role Permissions', 'Labor Link']} active={tab} onChange={setTab} />

        {tab === 'User Details' && (
          <main className="space-y-4">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AccessTile icon={ShieldCheck} label="Role" note={role?.status || 'No role'}>
                <Combobox className={tileControl} value={user.role || ''} suggestions={roleChoices} onChange={changeRole} placeholder="Select a role" disabled={!access.edit} />
              </AccessTile>

              <AccessTile icon={Building2} label="Site Scope" note={everySite(user.site) ? 'Every site' : 'Listed sites only'}>
                <Combobox className={tileControl} value={user.site || ''} suggestions={siteOptions} onChange={updateField('site')} placeholder="All Sites" disabled={!access.edit} />
              </AccessTile>

              <AccessTile icon={Building2} label="Department Scope" note={everyDepartment(user.department) ? 'Every department' : 'Listed departments only'}>
                <Combobox className={tileControl} value={user.department || ''} suggestions={departmentOptions} onChange={updateField('department')} placeholder="All Departments" disabled={!access.edit} />
              </AccessTile>

              <AccessTile icon={BriefcaseBusiness} label="Labor" note={labor?.craft || 'No labor link'}>
                <strong className="mt-2 block truncate text-xl font-extrabold text-[var(--app-ink)]">{user.laborId || '-'}</strong>
              </AccessTile>
            </section>

            <Surface>
              <SurfaceHeader eyebrow="Account" title="User Information" actions={<UserRound className="text-[var(--app-muted)]" size={18} />} />
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="User ID" value={user.userId} locked />
                <EditableField label="Username" value={user.username || ''} onCommit={commitField('username')} disabled={!access.edit} />
                <Field label="Status" value={user.status} options={userStatuses} onChange={changeStatus} disabled={!access.edit} />
                <Field label="Data View" value={user.dataScopeOverride || 'ROLE'} options={userDataScopeOptions} onChange={updateField('dataScopeOverride')} disabled={!access.edit} />
                <EditableField label="Name" value={user.name || ''} onCommit={commitField('name')} disabled={!access.edit} />
                <EditableField label="Email" value={user.email || ''} onCommit={commitField('email')} placeholder="name@company.com" disabled={!access.edit} />
                <EditableField label="New Password" value="" type="password" placeholder="Leave blank to keep current" clearOnCommit onCommit={commitField('password')} disabled={!access.edit} />
                <Field label="Last Login" value={user.lastLogin || '-'} locked />
              </div>
            </Surface>
          </main>
        )}

        {tab === 'Role Permissions' && (
          <TablePanel>
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
          </TablePanel>
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
                ['Site Scope', user.site],
                ['Department Scope', user.department],
                ['Data View', dataScopeLabel(user.dataScope)],
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
        summary={[['Role', user.role], ['Site', user.site], ['Department', user.department], ['Data View', dataScopeLabel(user.dataScope)]]}
        sections={[
          { title: 'User Information', rows: [[['User ID', user.userId], ['Username', user.username], ['Name', user.name], ['Email', user.email]]] },
          { title: 'Access Linkage', rows: [[['Role', user.role], ['Labor ID', user.laborId || '-'], ['Site', user.site], ['Department', user.department], ['Data View', dataScopeLabel(user.dataScope)]]] }
        ]}
      />
    </section>
  )
}

