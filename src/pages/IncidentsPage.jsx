import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, Plus } from 'lucide-react'
import IncidentDetailPage from '../components/incidents/IncidentDetailPage'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import PageHeader from '../components/ui/PageHeader'
import MasterRecordModal from '../components/master-data/MasterRecordModal'

const incidentSeed = [
  {
    incidentNumber: 'INC-2026-0001',
    description: 'Water leak created a slip hazard near meeting room',
    site: '1031',
    department: 'Civil',
    location: 'RC-1031-RD-001-OO-054',
    severity: 'High',
    status: 'Open',
    reportedBy: 'Maha Alotaibi',
    reportedDate: '2026-07-14T09:15'
  },
  {
    incidentNumber: 'INC-2026-0002',
    description: 'Electrical panel access blocked by stored materials',
    site: '1031',
    department: 'Electrical',
    location: 'RC-1031-EL-002',
    severity: 'Medium',
    status: 'Under review',
    reportedBy: 'Ahmed Faisal',
    reportedDate: '2026-07-13T14:30'
  }
]

const statusTone = status => status === 'Closed' ? 'green' : status === 'Under review' ? 'blue' : 'orange'
const incidentTemplateHeaders = ['incidentNumber', 'description', 'site', 'department', 'location', 'severity', 'status', 'reportedBy', 'reportedDate']

export default function IncidentsPage() {
  const [rows, setRows] = useState(incidentSeed)
  const [tab, setTab] = useState('All Incidents')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({})
  const [imported, setImported] = useState('')
  const routeId = decodeURIComponent(window.location.pathname.split('/incidents/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.incidentNumber === routeId) || null)

  const filteredRows = useMemo(() => {
    if (tab === 'Open') return rows.filter(row => row.status !== 'Closed')
    if (tab === 'Closed') return rows.filter(row => row.status === 'Closed')
    return rows
  }, [rows, tab])

  const addIncident = () => {
    const nextNumber = `INC-2026-${String(rows.length + 1).padStart(4, '0')}`
    setRows(current => [
      {
        incidentNumber: nextNumber,
        status: 'Open',
        reportedDate: new Date().toISOString().slice(0, 16),
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

  const importRows = importedRows => {
    setRows(importedRows.map((row, index) => ({
      incidentNumber: row.incidentNumber || `INC-IMPORT-${String(index + 1).padStart(4, '0')}`,
      description: row.description || '',
      site: row.site || '',
      department: row.department || '',
      location: row.location || '',
      severity: row.severity || 'Medium',
      status: row.status || 'Open',
      reportedBy: row.reportedBy || '',
      reportedDate: row.reportedDate || ''
    })))
  }

  if (selected) return <IncidentDetailPage incident={selected} onBack={close} />

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HSE & OPERATIONS"
        title="Incidents"
        description="Standalone incident records separated from PM and CM work-order processes."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={incidentTemplateHeaders} fileName="Incidents_Template.xlsx" />
            <ExcelImportButton label="Import Excel" fileName={imported} onFile={setImported} onImport={importRows} />
            <Button onClick={() => { setForm({ severity: 'Medium' }); setModalOpen(true) }}><Plus size={15} />New incident</Button>
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="incidents" onClear={() => setImported('')} />

      <IndexTabs
        tabs={[
          { label: 'All Incidents', count: rows.length },
          { label: 'Open', count: rows.filter(row => row.status !== 'Closed').length },
          { label: 'Closed', count: rows.filter(row => row.status === 'Closed').length }
        ]}
        active={tab}
        onChange={setTab}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
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
            { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value}</Badge> },
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
            { key: 'site', label: 'Site', required: true },
            { key: 'department', label: 'Department', required: true },
            { key: 'location', label: 'Location', required: true },
            { key: 'severity', label: 'Severity', required: true, options: ['Low', 'Medium', 'High', 'Critical'] },
            { key: 'status', label: 'Status', required: true, options: ['Open', 'Under review', 'Closed'] },
            { key: 'reportedBy', label: 'Reported By', required: true },
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
