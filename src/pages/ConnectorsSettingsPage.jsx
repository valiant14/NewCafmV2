import { useState } from 'react'
import { Activity, FileText, Hash, KeyRound, Lock, Mail, Plus, Send, Server, User, Wifi } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import TablePanel from '../components/ui/TablePanel'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { nowLocalDate } from '../lib/datetime'
import { api } from '../services/api'
import useModuleAccess from '../hooks/useModuleAccess'
import { useToast } from '../providers/ToastProvider'

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

const connector = { section: 'Connector', sectionIcon: Mail, sectionNote: 'What this delivery service is called and whether it is in use', sectionSpan: 'full' }
const endpoint = { section: 'Endpoint', sectionIcon: Server, sectionNote: 'Where messages are handed off, and how the connection is secured', sectionTone: 'green', sectionSpan: 'full' }
const credentials = { section: 'Credentials', sectionIcon: KeyRound, sectionNote: 'Stored in the CAFM database - nothing is sent until a delivery service is connected', sectionTone: 'orange', sectionSpan: 'full' }

const fields = [
<<<<<<< HEAD
  { key: 'name', label: 'Connector Name', required: true, placeholder: 'Primary mail relay' },
  { key: 'type', label: 'Type', required: true, options: connectorTypes },
  { key: 'host', label: 'Host / Endpoint', required: true, placeholder: 'smtp.seder.com' },
  { key: 'port', label: 'Port', type: 'number', placeholder: '587' },
  { key: 'encryption', label: 'Encryption', options: encryptionModes },
  { key: 'username', label: 'Username / API Key', placeholder: 'cafm@seder.com' },
  { key: 'password', label: 'Password / Secret', type: 'password', placeholder: 'Leave blank to keep the stored secret' },
  { key: 'sender', label: 'From Address / Sender ID', placeholder: 'no-reply@seder.com or SEDER' },
  { key: 'notes', label: 'Notes', placeholder: 'Who owns this connector' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }
=======
  { ...connector, key: 'name', label: 'Connector Name', icon: Mail, required: true, placeholder: 'Primary mail relay' },
  { ...connector, key: 'type', label: 'Type', icon: Send, required: true, options: connectorTypes },
  { ...connector, key: 'status', label: 'Status', icon: Activity, options: ['Active', 'Inactive'] },
  { ...connector, key: 'notes', label: 'Notes', icon: FileText, placeholder: 'Who owns this connector' },
  { ...endpoint, key: 'host', label: 'Host / Endpoint', icon: Server, required: true, placeholder: 'smtp.seder.com' },
  { ...endpoint, key: 'port', label: 'Port', icon: Hash, type: 'number', placeholder: '587' },
  { ...endpoint, key: 'encryption', label: 'Encryption', icon: Lock, options: encryptionModes },
  { ...credentials, key: 'username', label: 'Username / API Key', icon: User, placeholder: 'cafm@seder.com' },
  { ...credentials, key: 'password', label: 'Password / Secret', icon: KeyRound, type: 'password', placeholder: 'Stored in database' },
  { ...credentials, key: 'sender', label: 'From Address / Sender ID', icon: Send, placeholder: 'no-reply@seder.com or SEDER' }
>>>>>>> 780cca193302d3bb24f5fb5825d64cc409bfd027
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
  const { notify } = useToast()
  const access = useModuleAccess('SMTP & SMS')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyConnector)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState('')
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

  const testConnector = async (event, row) => {
    event.stopPropagation()
    setTesting(row.name)
    try {
      const result = await api.post(`/smtp-sms-connectors/${encodeURIComponent(row.name)}/test`, {})
      notify(`${row.name}: ${result.message || 'Connection test passed.'}`, 'success')
    } catch (testError) {
      notify(`${row.name}: ${testError.message || 'Connection test failed.'}`, 'error')
    } finally {
      setTesting('')
    }
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
            {access.create && <Button onClick={openNew}><Plus size={17} />Add connector</Button>}
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

      <TablePanel tone="blue">
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
              { key: 'port', label: 'Port', render: value => <Badge tone="neutral">{value || '-'}</Badge> },
              // An unencrypted connector is worth spotting in a list of them.
              { key: 'encryption', label: 'Encryption', render: value => <Badge tone={/^none$/i.test(String(value)) ? 'orange' : 'green'}>{value || 'None'}</Badge> },
              { key: 'sender', label: 'Sender', render: value => value || <span className="text-[var(--app-muted)]">Not set</span> },
              { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> },
              { key: 'createdDate', label: 'Created', render: value => value || '-' },
              {
                key: 'actions',
                label: 'Action',
                sortable: false,
                render: (_, row) => (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    disabled={testing === row.name}
                    onClick={event => testConnector(event, row)}
                  >
                    <Wifi size={14} />
                    {testing === row.name ? 'Testing' : 'Test'}
                  </Button>
                )
              }
            ]}
          />
        ) : (
          <EmptyState icon={Mail} title="No connectors configured" description="Add the SMTP or SMS service details that notifications should be sent through." />
        )}
      </TablePanel>

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
