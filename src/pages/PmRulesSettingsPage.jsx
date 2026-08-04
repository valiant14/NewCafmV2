import { useState } from 'react'
import { ExternalLink, Plus, Repeat, Save } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { Field } from '../components/ui/FormControls'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { nowLocalDate } from '../lib/datetime'

// Same enum the PM schedule form uses, so a rule can never describe a frequency the
// schedules themselves cannot hold.
const frequencyUnits = ['MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS']
const woStatuses = ['WSCH', 'APPR', 'WAPPR']
const usesTriggerHour = unit => !['MINUTES', 'HOURS'].includes(unit)
const cleanTriggerHour = (unit, value) => usesTriggerHour(unit) ? Math.max(0, Math.min(23, Number(value) || 0)) : 0

const emptyRule = {
  name: '',
  frequency: 1,
  freqUnit: 'MONTHS',
  leadTimeDays: 0,
  horizonDays: 30,
  triggerHour: 0,
  woPrefix: 'PMWO-',
  defaultWoStatus: woStatuses[0],
  notes: '',
  status: 'Active',
  createdDate: ''
}

const fields = [
  { key: 'name', label: 'Rule Name', required: true, placeholder: 'Monthly HVAC schedules' },
  { key: 'frequency', label: 'Every', required: true, type: 'number', placeholder: '1' },
  { key: 'freqUnit', label: 'Frequency Unit', required: true, options: frequencyUnits },
  { key: 'leadTimeDays', label: 'Lead Time (Days)', type: 'number', placeholder: '7' },
  { key: 'horizonDays', label: 'Generation Horizon (Days)', type: 'number', placeholder: '30' },
  { key: 'triggerHour', label: 'Trigger Hour (0-23)', type: 'number', placeholder: '6' },
  { key: 'woPrefix', label: 'Work Order Prefix', placeholder: 'PMWO-' },
  { key: 'defaultWoStatus', label: 'Default WO Status', options: woStatuses },
  { key: 'notes', label: 'Notes', placeholder: 'Which schedules this rule covers' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }
]

const exportColumns = [
  { key: 'name', header: 'Rule Name' },
  { key: 'frequency', header: 'Every' },
  { key: 'freqUnit', header: 'Frequency Unit' },
  { key: 'leadTimeDays', header: 'Lead Time (Days)' },
  { key: 'horizonDays', header: 'Generation Horizon (Days)' },
  { key: 'triggerHour', header: 'Trigger Hour' },
  { key: 'woPrefix', header: 'Work Order Prefix' },
  { key: 'defaultWoStatus', header: 'Default WO Status' },
  { key: 'notes', header: 'Notes' },
  { key: 'status', header: 'Status' },
  { key: 'createdDate', header: 'Created' }
]

const templateHeaders = exportColumns.map(column => column.header)

const mapImportRows = rows => rows.map(row => ({
  ...emptyRule,
  name: row['Rule Name'] || row.RULE_NAME || '',
  frequency: Math.max(1, Number(row.Every || row.FREQUENCY) || 1),
  freqUnit: row['Frequency Unit'] || row.FREQUENCY_UNIT || 'MONTHS',
  leadTimeDays: Math.max(0, Number(row['Lead Time (Days)'] || row.LEAD_TIME_DAYS) || 0),
  horizonDays: Math.max(0, Number(row['Generation Horizon (Days)'] || row.HORIZON_DAYS) || 0),
  triggerHour: cleanTriggerHour(row['Frequency Unit'] || row.FREQUENCY_UNIT || 'MONTHS', row['Trigger Hour'] || row.TRIGGER_HOUR),
  woPrefix: row['Work Order Prefix'] || row.WO_PREFIX || 'PMWO-',
  defaultWoStatus: row['Default WO Status'] || row.DEFAULT_WO_STATUS || 'WSCH',
  notes: row.Notes || row.NOTES || '',
  status: row.Status || row.STATUS || 'Active',
  createdDate: row.Created || row.CREATED || nowLocalDate()
})).filter(row => row.name)

const normalize = value => String(value || '').trim()

function PmRuleDetail({ rule, rows, setRows, pmSchedules = [], workOrders = [], onBack }) {
  const [form, setForm] = useState({ ...emptyRule, ...rule })
  const [error, setError] = useState('')
  const relatedPm = pmSchedules.filter(pm => normalize(pm.scheduleRule).toLowerCase() === normalize(rule.name).toLowerCase())
  const relatedPmNumbers = new Set(relatedPm.map(pm => pm.pmNumber))
  const historyRows = workOrders.filter(order => relatedPmNumbers.has(order['PM NUMBER']))
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const setFrequencyUnit = value => setForm(current => ({ ...current, freqUnit: value, triggerHour: cleanTriggerHour(value, current.triggerHour) }))
  const openRoute = path => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  const save = () => {
    if (!form.name || !form.freqUnit) return setError('Rule name and frequency unit are required.')
    const record = {
      ...form,
      name: rule.name,
      frequency: Math.max(1, Number(form.frequency) || 1),
      leadTimeDays: Math.max(0, Number(form.leadTimeDays) || 0),
      horizonDays: Math.max(0, Number(form.horizonDays) || 0),
      triggerHour: cleanTriggerHour(form.freqUnit, form.triggerHour),
      status: form.status || 'Active'
    }
    setRows(current => current.map(row => row.name === rule.name ? record : row))
    setError('')
  }

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="PM SCHEDULE RULE"
        title={rule.name}
        description="Edit the generation rule and review PM schedules controlled by it."
        actions={<div className="flex items-center gap-2"><Button variant="outline" onClick={onBack}>Back to rules</Button><Button onClick={save}><Save size={16} />Save rule</Button></div>}
      />

      {error && <div className="rounded-2xl border border-[#f2c5ba] bg-[#fff4f1] px-4 py-3 text-sm font-bold text-[#9b3f2d]">{error}</div>}

      <section className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
        <header className="mb-4 border-b border-[var(--app-line)] pb-4">
          <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">Edit Area</span>
          <h2 className="text-base font-extrabold text-[var(--app-ink)]">Schedule Control</h2>
        </header>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Rule Name" value={form.name} disabled onChange={() => {}} />
          <Field label="Every" type="number" value={form.frequency} required onChange={event => set('frequency', event.target.value)} />
          <Field label="Frequency Unit" value={form.freqUnit} required options={frequencyUnits} onChange={event => setFrequencyUnit(event.target.value)} />
          <Field label="Lead Time (Days)" type="number" value={form.leadTimeDays} onChange={event => set('leadTimeDays', event.target.value)} />
          <Field label="Generation Horizon (Days)" type="number" value={form.horizonDays} onChange={event => set('horizonDays', event.target.value)} />
          <Field label="Trigger Hour (0-23)" type="number" value={form.triggerHour} disabled={!usesTriggerHour(form.freqUnit)} onChange={event => set('triggerHour', cleanTriggerHour(form.freqUnit, event.target.value))} />
          <Field label="Work Order Prefix" value={form.woPrefix} onChange={event => set('woPrefix', event.target.value)} />
          <Field label="Default WO Status" value={form.defaultWoStatus} options={woStatuses} onChange={event => set('defaultWoStatus', event.target.value)} />
          <Field label="Status" value={form.status} options={['Active', 'Inactive']} onChange={event => set('status', event.target.value)} />
          <div className="xl:col-span-3"><Field label="Notes" type="textarea" value={form.notes} onChange={event => set('notes', event.target.value)} /></div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
        <header className="mb-4 flex items-center justify-between border-b border-[var(--app-line)] pb-4">
          <div><span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">PM Related Link</span><h2 className="text-base font-extrabold text-[var(--app-ink)]">Preventive Maintenance Using This Rule</h2></div>
          <Badge tone={relatedPm.length ? 'blue' : 'neutral'}>{relatedPm.length} PM</Badge>
        </header>
        {relatedPm.length ? (
          <DataTable
            rows={relatedPm}
            rowKey="pmNumber"
            sourceLabel="PM schedules"
            columns={[
              { key: 'pmNumber', label: 'PM Number', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
              { key: 'description', label: 'Description' },
              { key: 'asset', label: 'Asset' },
              { key: 'jobPlan', label: 'Job Plan' },
              { key: 'startDate', label: 'Next Run' },
              { key: 'pmCounter', label: 'Generated' },
              { key: 'pmStatus', label: 'Status', render: value => <Badge tone={value === 'ACTIVE' ? 'green' : 'orange'}>{value}</Badge> },
              { key: 'open', label: '', render: (_, pm) => <Button variant="outline" size="sm" onClick={event => { event.stopPropagation(); openRoute(`/preventive-maintenance/${encodeURIComponent(pm.pmNumber)}`) }}><ExternalLink size={14} />Open</Button> }
            ]}
          />
        ) : (
          <EmptyState icon={Repeat} title="No linked PM schedules" description="Select this rule in a PM schedule or import PM records with this PM RULE name." />
        )}
      </section>

      <section className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-[0_8px_24px_rgba(32,55,45,.05)]">
        <header className="mb-4 flex items-center justify-between border-b border-[var(--app-line)] pb-4">
          <div><span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--app-muted)]">History Logs</span><h2 className="text-base font-extrabold text-[var(--app-ink)]">Generated Work Orders</h2></div>
          <Badge tone={historyRows.length ? 'green' : 'neutral'}>{historyRows.length} WO</Badge>
        </header>
        {historyRows.length ? (
          <DataTable
            rows={historyRows}
            rowKey="WORKORDER"
            sourceLabel="Generated work orders"
            pagination
            columns={[
              { key: 'WORKORDER', label: 'Work Order', render: value => <strong className="mono text-[var(--app-ink)]">{value}</strong> },
              { key: 'PM NUMBER', label: 'PM Number' },
              { key: 'DESCRIPTION', label: 'Description' },
              { key: 'STATUS', label: 'Status', render: value => <Badge tone={['COMP', 'CLOSE'].includes(value) ? 'green' : 'blue'}>{value}</Badge> },
              { key: 'TARGET START ', label: 'Target Start' },
              { key: 'PM CYCLE', label: 'PM Cycle' },
              { key: 'open', label: '', render: (_, order) => <Button variant="outline" size="sm" onClick={event => { event.stopPropagation(); openRoute(`/work-orders/${encodeURIComponent(order.WORKORDER)}`) }}><ExternalLink size={14} />Open</Button> }
            ]}
          />
        ) : (
          <EmptyState icon={Repeat} title="No generated history yet" description="When PM generation creates work orders from this rule, the history will appear here." />
        )}
      </section>
    </section>
  )
}

export default function PmRulesSettingsPage({ rows = [], setRows, pmSchedules = [], workOrders = [] }) {
  const [tab, setTab] = useState('All')
  const [routePath, setRoutePath] = useState(window.location.pathname)
  const [filters, setFilters] = useState(emptyStandardFilters)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyRule)
  const [error, setError] = useState('')
  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, { status: ['status'], date: ['createdDate'] })
  const routeId = decodeURIComponent(routePath.split('/pm-rules/')[1] || '')
  const selectedRule = rows.find(row => row.name === routeId)

  const openNew = () => {
    setEditing(null)
    setForm(emptyRule)
    setError('')
    setModalOpen(true)
  }

  const openEdit = row => {
    window.history.pushState({}, '', `/pm-rules/${encodeURIComponent(row.name)}`)
    setRoutePath(window.location.pathname)
    setEditing(null)
  }

  const save = () => {
    const name = String(form.name || '').trim()
    if (!name || !form.freqUnit) return
    if (rows.some(row => row.name === name && row.name !== editing)) return setError('Rule name already exists.')
    const record = {
      ...form,
      name,
      frequency: Math.max(1, Number(form.frequency) || 1),
      leadTimeDays: Math.max(0, Number(form.leadTimeDays) || 0),
      horizonDays: Math.max(0, Number(form.horizonDays) || 0),
      triggerHour: cleanTriggerHour(form.freqUnit, form.triggerHour),
      createdDate: form.createdDate || nowLocalDate()
    }
    setRows(current => editing
      ? current.map(row => row.name === editing ? record : row)
      : [record, ...current]
    )
    setModalOpen(false)
  }

  if (selectedRule) {
    return <PmRuleDetail rule={selectedRule} rows={rows} setRows={setRows} pmSchedules={pmSchedules} workOrders={workOrders} onBack={() => { window.history.pushState({}, '', '/pm-rules'); setRoutePath('/pm-rules') }} />
  }

  return (
    <>
      <PageHeader
        eyebrow="SETTINGS"
        title="PM Schedule Rules"
        description="Generation defaults for preventive maintenance schedules, and manual work-order generation."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="PM_Schedule_Rules_Template.xlsx" />
            <ExportExcelButton module="PM Schedule Rules" rows={visibleRows} columns={exportColumns} />
            <ExcelImportButton onImport={importedRows => { const imported = mapImportRows(importedRows); if (imported.length) setRows(current => [...imported, ...current.filter(row => !imported.some(item => item.name === row.name))]) }} />
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
              { key: 'frequency', label: 'Every' },
              { key: 'freqUnit', label: 'Unit' },
              { key: 'leadTimeDays', label: 'Lead Time (Days)' },
              { key: 'horizonDays', label: 'Horizon (Days)' },
              { key: 'triggerHour', label: 'Trigger Hour', render: (value, row) => usesTriggerHour(row.freqUnit) ? `${String(value ?? 0).padStart(2, '0')}:00` : 'Auto' },
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
          note="Rules control when PM schedules are eligible to generate work orders."
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
