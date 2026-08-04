import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, Plus } from 'lucide-react'
import IncidentDetailPage from '../components/incidents/IncidentDetailPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import StandardFilters from '../components/ui/StandardFilters'
import { departmentOptions, laborNameOptions, locationOptions, siteOptions } from '../lib/masterOptions'
import { applyStandardFilters, optionsFromRows, scopedStandardFilters, useScopedFilters } from '../lib/standardFilters'
import { normalizeStatus, statusDescription, statusTone } from '../lib/statusMatrix'
import { nowLocalDateTime } from '../lib/datetime'
import { useAuth } from '../providers/AuthProvider'

const exportColumns = [
  { key: 'incidentNumber', label: 'Incident Number' },
  { key: 'description', label: 'Description' },
  { key: 'site', label: 'Site' },
  { key: 'department', label: 'Department' },
  { key: 'location', label: 'Location' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'reportedBy', label: 'Reported By' },
  { key: 'reportedDate', label: 'Reported Date' }
]

const incidentTemplateHeaders = ['incidentNumber', 'description', 'site', 'department', 'location', 'severity', 'status', 'reportedBy', 'reportedDate']

export default function IncidentsPage({ rows, setRows, siteRecords = [], departmentRecords = [], locationRows = [], laborRows = [] }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({})
  const [imported, setImported] = useState('')
  const [filters, setFilters] = useScopedFilters(user, rows)
  const routeId = decodeURIComponent(window.location.pathname.split('/incidents/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.incidentNumber === routeId) || null)
  useEffect(() => {
    if (!routeId) return
    const latest = rows.find(row => row.incidentNumber === routeId)
    if (latest) setSelected(latest)
  }, [rows, routeId])

  const tabRows = useMemo(() => {
    if (tab !== 'All') return rows.filter(row => row.status === tab)
    return rows
  }, [rows, tab])
  const filteredRows = useMemo(() => applyStandardFilters(tabRows, filters, { date: ['reportedDate'] }), [tabRows, filters])

  const addIncident = () => {
    const nextNumber = `INC-2026-${String(rows.length + 1).padStart(4, '0')}`
    setRows(current => [
      {
        incidentNumber: nextNumber,
        status: 'NEW',
        reportedDate: nowLocalDateTime(),
        ...form
      },
      ...current
    ])
    setForm({})
    setModalOpen(false)
  }

  const open = incident => {
    setSelected(incident)
    window.history.pushState({}, '', `/incidents/${encodeURIComponent(incident.incidentNumber)}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/incidents')
  }
  const updateIncident = (incidentNumber, patch) => {
    setRows(current => current.map(row => row.incidentNumber === incidentNumber ? { ...row, ...patch } : row))
    setSelected(current => current?.incidentNumber === incidentNumber ? { ...current, ...patch } : current)
  }

  const importRows = importedRows => {
    setRows(importedRows.map((row, index) => ({
      incidentNumber: row.incidentNumber || `INC-IMPORT-${String(index + 1).padStart(4, '0')}`,
      description: row.description || '',
      site: row.site || '',
      department: row.department || '',
      location: row.location || '',
      severity: row.severity || 'Medium',
      status: normalizeStatus('incident', row.status, 'NEW'),
      reportedBy: row.reportedBy || '',
      reportedDate: row.reportedDate || ''
    })))
  }

  if (selected) return <IncidentDetailPage incident={selected} onBack={close} onUpdate={updateIncident} />

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HSE & OPERATIONS"
        title="Incidents"
        description="Standalone incident records separated from PM and CM work-order processes."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={incidentTemplateHeaders} fileName="Incidents_Template.xlsx" />
            <ExportExcelButton module="Incidents" rows={filteredRows} columns={exportColumns} />
            <ExcelImportButton label="Import Excel" fileName={imported} onFile={setImported} onImport={importRows} />
            <Button onClick={() => { setForm({ severity: 'Medium' }); setModalOpen(true) }}><Plus size={15} />New incident</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="incidents" onClear={() => setImported('')} />

      <IndexTabs
        tabs={[
          { key: 'All', label: 'All Incidents', count: rows.length },
          { key: 'NEW', label: 'New', count: rows.filter(row => row.status === 'NEW').length },
          { key: 'INPRG', label: 'In Progress', count: rows.filter(row => row.status === 'INPRG').length },
          { key: 'RESOLVED', label: 'Resolved', count: rows.filter(row => row.status === 'RESOLVED').length },
          { key: 'CLOSED', label: 'Closed', count: rows.filter(row => row.status === 'CLOSED').length }
        ]}
        active={tab}
        onChange={value => { setTab(value); setFilters(scopedStandardFilters(user, rows)) }}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <section className="overflow-hidden rounded-3xl border border-[var(--app-line)] bg-[var(--app-panel)] shadow-[0_12px_32px_rgba(15,23,42,.06)]">
        <DataTable
          rows={filteredRows}
          rowKey="incidentNumber"
          onRowClick={open}
          pagination
          columns={[
            { key: 'incidentNumber', label: 'Incident', render: (value, row) => <div><strong className="font-semibold text-[var(--app-ink)]">{value}</strong><span className="block text-xs text-[var(--app-muted)]">{row.description}</span></div> },
            { key: 'site', label: 'Site' },
            { key: 'department', label: 'Department' },
            { key: 'location', label: 'Location' },
            { key: 'severity', label: 'Severity', render: value => <Badge tone={value === 'Critical' || value === 'High' ? 'orange' : 'blue'}>{value}</Badge> },
            { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value} · {statusDescription('incident', value)}</Badge> },
            { key: 'reportedBy', label: 'Reported By' },
            { key: 'open', label: '', render: () => <ChevronRight size={17} /> }
          ]}
          emptyIcon={AlertTriangle}
          emptyTitle="No incidents yet"
          emptyDescription="Create standalone incident records here after the client confirms the final required fields."
        />
      </section>

      {modalOpen && (
        <MasterRecordModal
          title="New incident"
          note="Record an incident separately from corrective and preventive maintenance work orders."
          form={form}
          setForm={setForm}
          fields={[
            { key: 'description', label: 'Description', required: true, full: true },
            { key: 'site', label: 'Site', required: true, suggestions: siteOptions(siteRecords), placeholder: 'Select a site' },
            { key: 'department', label: 'Department', required: true, suggestions: departmentOptions(departmentRecords), placeholder: 'Select a department' },
            { key: 'location', label: 'Location', required: true, suggestions: locationOptions(locationRows), placeholder: 'Select a location' },
            { key: 'severity', label: 'Severity', required: true, options: ['Low', 'Medium', 'High', 'Critical'] },
            { key: 'status', label: 'Status', required: true, options: ['NEW', 'INPRG', 'RESOLVED', 'CLOSED'] },
            { key: 'reportedBy', label: 'Reported By', required: true, suggestions: laborNameOptions(laborRows), placeholder: 'Select who reported it' },
            { key: 'reportedDate', label: 'Reported Date', type: 'datetime-local' }
          ]}
          onClose={() => setModalOpen(false)}
          onSave={addIncident}
          submitLabel="Create incident"
        />
      )}
    </div>
  )
}

