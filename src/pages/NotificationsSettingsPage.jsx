import { useState } from 'react'
import { Bell, Plus } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { nowLocalDate } from '../lib/datetime'
import { readNotificationRules, storedListSetter, writeNotificationRules } from '../lib/settingsStore'

const events = [
  'Work order overdue',
  'Work order upcoming',
  'Work order on hold',
  'PM due',
  'Incident raised',
  'Purchase request submitted'
]
const channels = ['In-app', 'Email', 'SMS']

const emptyRule = {
  id: '',
  event: events[0],
  channel: channels[0],
  recipients: '',
  notes: '',
  status: 'Active',
  createdDate: ''
}

const splitRecipients = value => {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
  return String(value || '')
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

const normalizeRecipients = value => {
  const seen = new Set()
  return splitRecipients(value)
    .filter(item => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join(', ')
}

const renderRecipients = value => {
  const recipients = splitRecipients(value)
  if (!recipients.length) return 'Not set'
  const shown = recipients.slice(0, 3)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map(recipient => (
        <span key={recipient} className="rounded-full bg-[var(--app-soft)] px-2 py-1 text-[11px] font-bold text-[var(--app-ink)]">
          {recipient}
        </span>
      ))}
      {recipients.length > shown.length && (
        <Badge tone="blue">+{recipients.length - shown.length}</Badge>
      )}
    </div>
  )
}

const fields = [
  { key: 'id', label: 'Rule ID', required: true, placeholder: 'NOTIF-001' },
  { key: 'event', label: 'Event', required: true, options: events },
  { key: 'channel', label: 'Channel', required: true, options: channels },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] },
  { key: 'recipients', label: 'Recipients', type: 'textarea', fullWidth: true, placeholder: 'ahmed@seder.com, ops@seder.com\nmanager@seder.com' },
  { key: 'notes', label: 'Notes', type: 'textarea', minRows: 'compact', fullWidth: true, placeholder: 'When and why this rule fires' }
]

const exportColumns = [
  { key: 'id', header: 'Rule ID' },
  { key: 'event', header: 'Event' },
  { key: 'channel', header: 'Channel' },
  { key: 'recipients', header: 'Recipients' },
  { key: 'notes', header: 'Notes' },
  { key: 'status', header: 'Status' },
  { key: 'createdDate', header: 'Created' }
]

export default function NotificationsSettingsPage() {
  const [rows, setRowsState] = useState(readNotificationRules)
  const setRows = storedListSetter(setRowsState, writeNotificationRules)
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyRule)
  const [error, setError] = useState('')
  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, { status: ['status'], date: ['createdDate'] })

  const openNew = () => {
    setEditing(null)
    setForm(emptyRule)
    setError('')
    setModalOpen(true)
  }

  const openEdit = row => {
    setEditing(row.id)
    setForm({ ...emptyRule, ...row })
    setError('')
    setModalOpen(true)
  }

  const save = () => {
    const id = String(form.id || '').trim()
    if (!id || !form.event || !form.channel) return
    if (rows.some(row => row.id === id && row.id !== editing)) return setError('Rule ID already exists.')
    const record = { ...form, id, recipients: normalizeRecipients(form.recipients), createdDate: form.createdDate || nowLocalDate() }
    setRows(current => editing
      ? current.map(row => row.id === editing ? record : row)
      : [record, ...current]
    )
    setModalOpen(false)
  }

  return (
    <>
      <PageHeader
        eyebrow="SETTINGS"
        title="Notifications"
        description="Define which events raise a notification, on which channel, and who receives it."
        actions={(
          <div className="flex items-center gap-2">
            <ExportExcelButton module="Notification Rules" rows={visibleRows} columns={exportColumns} />
            <Button onClick={openNew}><Plus size={17} />Add rule</Button>
          </div>
        )}
      />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Rules', count: rows.length },
          { key: 'Active', label: 'Active', count: rows.filter(row => row.status === 'Active').length },
          { key: 'Inactive', label: 'Inactive', count: rows.filter(row => row.status === 'Inactive').length }
        ]}
      />

      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={[]}
        departmentOptions={[]}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_8px_24px_rgba(32,55,45,.05)]">
        {rows.length ? (
          <DataTable
            rows={visibleRows}
            rowKey="id"
            onRowClick={openEdit}
            pagination
            columns={[
              { key: 'id', label: 'Rule ID', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
              { key: 'event', label: 'Event' },
              { key: 'channel', label: 'Channel', render: value => <Badge tone={value === 'SMS' ? 'orange' : 'blue'}>{value}</Badge> },
              { key: 'recipients', label: 'Recipients', render: renderRecipients },
              { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> },
              { key: 'createdDate', label: 'Created', render: value => value || '-' }
            ]}
          />
        ) : (
          <EmptyState icon={Bell} title="No notification rules yet" description="Add a rule to record which events should notify which people." />
        )}
      </section>

      {modalOpen && (
        <MasterRecordModal
          title={editing ? 'Edit notification rule' : 'Add notification rule'}
          note="Use comma, semicolon, or a new line to add multiple recipients."
          fields={fields}
          form={form}
          setForm={setForm}
          error={error}
          submitLabel={editing ? 'Save rule' : 'Create rule'}
          onClose={() => setModalOpen(false)}
          onSave={save}
        />
      )}
    </>
  )
}
