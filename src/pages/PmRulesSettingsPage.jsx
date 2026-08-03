import { useState } from 'react'
import { Plus, Repeat } from 'lucide-react'
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
import { readPmRules, storedListSetter, writePmRules } from '../lib/settingsStore'

// Same enum the PM schedule form uses, so a rule can never describe a frequency the
// schedules themselves cannot hold.
const frequencyUnits = ['DAYS', 'WEEKS', 'MONTHS', 'YEARS']
const woStatuses = ['WSCH', 'APPR', 'WAPPR']

const emptyRule = {
  name: '',
  freqUnit: 'MONTHS',
  leadTimeDays: 0,
  horizonDays: 30,
  woPrefix: 'PMWO-',
  defaultWoStatus: woStatuses[0],
  notes: '',
  status: 'Active',
  createdDate: ''
}

const fields = [
  { key: 'name', label: 'Rule Name', required: true, placeholder: 'Monthly HVAC schedules' },
  { key: 'freqUnit', label: 'Frequency Unit', required: true, options: frequencyUnits },
  { key: 'leadTimeDays', label: 'Lead Time (Days)', type: 'number', placeholder: '7' },
  { key: 'horizonDays', label: 'Generation Horizon (Days)', type: 'number', placeholder: '30' },
  { key: 'woPrefix', label: 'Work Order Prefix', placeholder: 'PMWO-' },
  { key: 'defaultWoStatus', label: 'Default WO Status', options: woStatuses },
  { key: 'notes', label: 'Notes', placeholder: 'Which schedules this rule covers' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }
]

const exportColumns = [
  { key: 'name', header: 'Rule Name' },
  { key: 'freqUnit', header: 'Frequency Unit' },
  { key: 'leadTimeDays', header: 'Lead Time (Days)' },
  { key: 'horizonDays', header: 'Generation Horizon (Days)' },
  { key: 'woPrefix', header: 'Work Order Prefix' },
  { key: 'defaultWoStatus', header: 'Default WO Status' },
  { key: 'notes', header: 'Notes' },
  { key: 'status', header: 'Status' },
  { key: 'createdDate', header: 'Created' }
]

export default function PmRulesSettingsPage() {
  const [rows, setRowsState] = useState(readPmRules)
  const setRows = storedListSetter(setRowsState, writePmRules)
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
    setEditing(row.name)
    setForm({ ...emptyRule, ...row })
    setError('')
    setModalOpen(true)
  }

  const save = () => {
    const name = String(form.name || '').trim()
    if (!name || !form.freqUnit) return
    if (rows.some(row => row.name === name && row.name !== editing)) return setError('Rule name already exists.')
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
        title="PM Schedule Rules"
        description="Generation defaults for preventive maintenance schedules, and manual work-order generation."
        actions={(
          <div className="flex items-center gap-2">
            <ExportExcelButton module="PM Schedule Rules" rows={visibleRows} columns={exportColumns} />
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
            rowKey="name"
            onRowClick={openEdit}
            pagination
            columns={[
              { key: 'name', label: 'Rule', render: value => <strong className="text-[var(--app-ink)]">{value}</strong> },
              { key: 'freqUnit', label: 'Frequency Unit' },
              { key: 'leadTimeDays', label: 'Lead Time (Days)' },
              { key: 'horizonDays', label: 'Horizon (Days)' },
              { key: 'woPrefix', label: 'WO Prefix', render: value => <span className="mono">{value}</span> },
              { key: 'defaultWoStatus', label: 'Default WO Status' },
              { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> },
              { key: 'createdDate', label: 'Created', render: value => value || '-' }
            ]}
          />
        ) : (
          <EmptyState icon={Repeat} title="No PM rules yet" description="Add a rule to record the generation defaults for a group of PM schedules." />
        )}
      </section>

      {modalOpen && (
        <MasterRecordModal
          title={editing ? 'Edit PM rule' : 'Add PM rule'}
          note="Rules are stored in this browser. Generation still uses the values held on each PM schedule."
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
