import { useState } from 'react'
import { Mail, Plus } from 'lucide-react'
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

const connectorTypes = ['SMTP', 'SMS']
const encryptionModes = ['None', 'SSL', 'TLS']

const emptyConnector = {
  name: '',
  type: connectorTypes[0],
  host: '',
  port: '',
  encryption: encryptionModes[2],
  username: '',
  password: '',
  sender: '',
  notes: '',
  status: 'Active',
  createdDate: ''
}

const fields = [
  { key: 'name', label: 'Connector Name', required: true, placeholder: 'Primary mail relay' },
  { key: 'type', label: 'Type', required: true, options: connectorTypes },
  { key: 'host', label: 'Host / Endpoint', required: true, placeholder: 'smtp.seder.com' },
  { key: 'port', label: 'Port', type: 'number', placeholder: '587' },
  { key: 'encryption', label: 'Encryption', options: encryptionModes },
  { key: 'username', label: 'Username / API Key', placeholder: 'cafm@seder.com' },
  { key: 'password', label: 'Password / Secret', type: 'password', placeholder: 'Stored in database' },
  { key: 'sender', label: 'From Address / Sender ID', placeholder: 'no-reply@seder.com or SEDER' },
  { key: 'notes', label: 'Notes', placeholder: 'Who owns this connector' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }
]

const exportColumns = [
  { key: 'name', header: 'Connector Name' },
  { key: 'type', header: 'Type' },
  { key: 'host', header: 'Host' },
  { key: 'port', header: 'Port' },
  { key: 'encryption', header: 'Encryption' },
  { key: 'username', header: 'Username' },
  { key: 'sender', header: 'Sender' },
  { key: 'notes', header: 'Notes' },
  { key: 'status', header: 'Status' },
  { key: 'createdDate', header: 'Created' }
]

export default function ConnectorsSettingsPage({ rows = [], setRows }) {
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyConnector)
  const [error, setError] = useState('')
  const tabRows = tab === 'All' ? rows : rows.filter(row => row.type === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, { status: ['status'], date: ['createdDate'] })

  const openNew = () => {
    setEditing(null)
    setForm(emptyConnector)
    setError('')
    setModalOpen(true)
  }

  const openEdit = row => {
    setEditing(row.name)
    setForm({ ...emptyConnector, ...row })
    setError('')
    setModalOpen(true)
  }

  const save = () => {
    const name = String(form.name || '').trim()
    if (!name || !form.type || !form.host) return
    if (rows.some(row => row.name === name && row.name !== editing)) return setError('Connector name already exists.')
    const record = { ...form, name, createdDate: form.createdDate || nowLocalDate() }
    setRows(current => editing
      ? current.map(row => row.name === editing ? record : row)
      : [record, ...current]
    )
    setModalOpen(false)
  }

  return (
    <>
      <PageHeader
        eyebrow="SETTINGS"
        title="SMTP & SMS"
        description="Delivery connectors used to send notifications once a mail or SMS service is wired up."
        actions={(
          <div className="flex items-center gap-2">
            <ExportExcelButton module="Connectors" rows={visibleRows} columns={exportColumns} />
            <Button onClick={openNew}><Plus size={17} />Add connector</Button>
          </div>
        )}
      />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Connectors', count: rows.length },
          { key: 'SMTP', label: 'SMTP', count: rows.filter(row => row.type === 'SMTP').length },
          { key: 'SMS', label: 'SMS', count: rows.filter(row => row.type === 'SMS').length }
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
            rowKey="name"
            onRowClick={openEdit}
            pagination
            columns={[
              { key: 'name', label: 'Connector', render: value => <strong className="text-[var(--app-ink)]">{value}</strong> },
              { key: 'type', label: 'Type', render: value => <Badge tone={value === 'SMS' ? 'orange' : 'blue'}>{value}</Badge> },
              { key: 'host', label: 'Host / Endpoint', render: value => <span className="mono">{value}</span> },
              { key: 'port', label: 'Port' },
              { key: 'encryption', label: 'Encryption' },
              { key: 'sender', label: 'Sender', render: value => value || 'Not set' },
              { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> },
              { key: 'createdDate', label: 'Created', render: value => value || '-' }
            ]}
          />
        ) : (
          <EmptyState icon={Mail} title="No connectors configured" description="Add the SMTP or SMS service details that notifications should be sent through." />
        )}
      </section>

      {modalOpen && (
        <MasterRecordModal
          title={editing ? 'Edit connector' : 'Add connector'}
          note="Credentials are stored in the CAFM database. Nothing is sent until a delivery service is connected."
          fields={fields}
          form={form}
          setForm={setForm}
          error={error}
          submitLabel={editing ? 'Save connector' : 'Create connector'}
          onClose={() => setModalOpen(false)}
          onSave={save}
        />
      )}
    </>
  )
}
