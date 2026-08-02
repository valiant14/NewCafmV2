import { useState } from 'react'
import { Plus } from 'lucide-react'
import UserDetailPage from '../components/users/UserDetailPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { scopeRowsForUser } from '../lib/accessControl'

const emptyUser = {
  userId: '',
  username: '',
  password: '1234',
  name: '',
  email: '',
  role: 'Civil Technician',
  laborId: '',
  site: 'Riyadh / 1031',
  department: 'Civil',
  status: 'Active',
  lastLogin: ''
}

const baseFields = [
  { key: 'userId', label: 'User ID', required: true, placeholder: 'USR-0005' },
  { key: 'username', label: 'Username', required: true },
  { key: 'password', label: 'Password', required: true, type: 'password', placeholder: 'Set temporary password' },
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role', required: true },
  { key: 'laborId', label: 'Linked Labor' },
  { key: 'site', label: 'Site Scope' },
  { key: 'department', label: 'Department Scope' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive', 'Locked'] },
  { key: 'lastLogin', label: 'Last Login' }
]

const templateHeaders = Object.keys(emptyUser)
const toneByStatus = { Active: 'green', Inactive: 'orange', Locked: 'orange' }

export default function UsersPage({ rows = [], setRows, roleRows = [], laborRows = [], scopeUser, siteOptions = [], departmentOptions = [] }) {
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyUser)
  const routeId = decodeURIComponent(window.location.pathname.split('/users/')[1] || '')
  const fields = baseFields.map(field => {
    if (field.key === 'role') return { ...field, options: roleRows.map(row => row.role) }
    if (field.key === 'laborId') return { ...field, options: ['', ...laborRows.map(row => row.personId).filter(Boolean)] }
    if (field.key === 'site') return { ...field, suggestions: siteOptions, placeholder: 'All Sites or Riyadh / 1031, Jeddah / 1032' }
    if (field.key === 'department') return { ...field, suggestions: departmentOptions, placeholder: 'All Departments or HVAC, Civil' }
    return field
  })

  const scopedRows = scopeRowsForUser(rows, scopeUser, ['site'], ['department'])
  const [selected, setSelected] = useState(scopedRows.find(row => row.userId === routeId || row.username === routeId) || null)
  const tabRows = tab === 'All' ? scopedRows : scopedRows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status']
  })

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/users/${encodeURIComponent(row.userId)}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/users')
  }

  const updateUser = (userId, patch) => {
    setRows?.(current => current.map(row => row.userId === userId ? { ...row, ...patch } : row))
    setSelected(current => current?.userId === userId ? { ...current, ...patch } : current)
  }

  const save = () => {
    if (!form.userId || !form.username || !form.password || !form.name || !form.role) return
    setRows?.(current => [{ ...form }, ...current])
    setModalOpen(false)
    setForm(emptyUser)
    open(form)
  }

  if (selected) {
    return (
      <UserDetailPage
        user={selected}
        role={roleRows.find(row => row.role === selected.role)}
        labor={laborRows.find(row => row.personId === selected.laborId)}
        siteOptions={siteOptions}
        departmentOptions={departmentOptions}
        onBack={close}
        onUpdate={updateUser}
      />
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Users"
        description="Manage application users, role permissions, and linked labor resources."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Users_Template.xlsx" />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={setRows} />
            <Button onClick={() => setModalOpen(true)}><Plus size={17} />Add user</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="users" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Users', count: scopedRows.length },
          { key: 'Active', label: 'Active', count: scopedRows.filter(row => row.status === 'Active').length },
          { key: 'Inactive', label: 'Inactive', count: scopedRows.filter(row => row.status === 'Inactive').length },
          { key: 'Locked', label: 'Locked', count: scopedRows.filter(row => row.status === 'Locked').length }
        ]}
      />

      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(scopedRows, ['site'])}
        departmentOptions={optionsFromRows(scopedRows, ['department'])}
        statusOptions={optionsFromRows(scopedRows, ['status'])}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_8px_24px_rgba(32,55,45,.05)]">
        <DataTable
          rows={visibleRows}
          rowKey="userId"
          onRowClick={open}
          pagination
          columns={[
            { key: 'username', label: 'Username', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
            { key: 'name', label: 'Name' },
            { key: 'role', label: 'Role' },
            { key: 'laborId', label: 'Linked Labor', render: value => value || 'Not linked' },
            { key: 'site', label: 'Site Scope' },
            { key: 'department', label: 'Department Scope' },
            { key: 'lastLogin', label: 'Last Login' },
            { key: 'status', label: 'Status', render: value => <Badge tone={toneByStatus[value] || 'orange'}>{value}</Badge> }
          ]}
        />
      </section>

      {modalOpen && (
        <MasterRecordModal
          title="Add user"
          note="Create a user account and link it to a role and optional labor resource."
          fields={fields}
          form={form}
          setForm={setForm}
          onClose={() => setModalOpen(false)}
          onSave={save}
          submitLabel="Create user"
        />
      )}
    </>
  )
}
