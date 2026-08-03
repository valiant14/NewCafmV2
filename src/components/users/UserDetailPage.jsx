import { useEffect, useState } from 'react'
import { BriefcaseBusiness, Building2, ShieldCheck, UserRound, Users } from 'lucide-react'
import Badge from '../ui/Badge'
import Combobox from '../ui/Combobox'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import { DetailHeader, DetailTabs, InfoCard } from '../ui/DetailScaffold'
import GenericPrintReport from '../ui/GenericPrintReport'
import Field from '../ui/Field'

const userStatuses = ['Active', 'Inactive', 'Locked']
const toneByStatus = { Active: 'green', Inactive: 'orange', Locked: 'orange' }
const everySite = value => !String(value || '').trim() || /^all sites$/i.test(String(value).trim())
const everyDepartment = value => !String(value || '').trim() || /^all departments$/i.test(String(value).trim())

// Keeps the summary tiles at their original size and weight while making the value itself
// the control, so the page reads the same but every tile is editable where it is shown.
const tileControl = 'mt-1.5 w-full truncate rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xl font-extrabold tracking-[-.04em] text-[var(--app-ink)] outline-none transition hover:border-[var(--app-line)] hover:bg-[var(--app-soft-bg)] focus:border-[var(--app-field-focus)] focus:bg-[var(--app-panel)] focus:ring-4 focus:ring-[var(--app-field-focus-ring)]'

function AccessTile({ icon: Icon, label, note, children }) {
  return (
    <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-4 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">{label}</span>
        <Icon size={16} className="text-[var(--app-primary)]" />
      </div>
      {children}
      <small className="mt-1 block truncate text-[11px] font-semibold text-[var(--app-muted)]">{note}</small>
    </div>
  )
}

// Each keystroke would otherwise be its own save, so text edits are held locally and
// committed when the field is left or Enter is pressed.
function EditableField({ label, value = '', type, placeholder, clearOnCommit, onCommit }) {
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
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AccessTile icon={ShieldCheck} label="Role" note={role?.status || 'No role'}>
                <Combobox className={tileControl} value={user.role || ''} suggestions={roleChoices} onChange={changeRole} placeholder="Select a role" />
              </AccessTile>

              <AccessTile icon={Building2} label="Site Scope" note={everySite(user.site) ? 'Every site' : 'Listed sites only'}>
                <Combobox className={tileControl} value={user.site || ''} suggestions={siteOptions} onChange={updateField('site')} placeholder="All Sites" />
              </AccessTile>

              <AccessTile icon={Building2} label="Department Scope" note={everyDepartment(user.department) ? 'Every department' : 'Listed departments only'}>
                <Combobox className={tileControl} value={user.department || ''} suggestions={departmentOptions} onChange={updateField('department')} placeholder="All Departments" />
              </AccessTile>

              <AccessTile icon={BriefcaseBusiness} label="Labor" note={labor?.craft || 'No labor link'}>
                <strong className="mt-2 block truncate text-xl font-extrabold tracking-[-.04em] text-[var(--app-ink)]">{user.laborId || '-'}</strong>
              </AccessTile>
            </section>

            <section className="rounded-3xl border border-[var(--app-line)] bg-white p-5 shadow-[0_8px_24px_rgba(32,55,45,.06)]">
              <header className="mb-4 flex items-center gap-3 border-b border-[var(--app-line)] pb-4">
                <UserRound className="text-[var(--app-muted)]" size={18} />
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[var(--app-muted)]">ACCOUNT</span>
                  <h2 className="text-base font-extrabold text-[var(--app-ink)]">User Information</h2>
                </div>
              </header>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="User ID" value={user.userId} locked />
                <EditableField label="Username" value={user.username || ''} onCommit={commitField('username')} />
                <Field label="Status" value={user.status} options={userStatuses} onChange={changeStatus} />
                <EditableField label="Name" value={user.name || ''} onCommit={commitField('name')} />
                <EditableField label="Email" value={user.email || ''} onCommit={commitField('email')} placeholder="name@company.com" />
                <EditableField label="New Password" value="" type="password" placeholder="Leave blank to keep current" clearOnCommit onCommit={commitField('password')} />
                <Field label="Last Login" value={user.lastLogin || '-'} locked />
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
