import { useState } from 'react'
import { ChevronRight, MapPin, Plus } from 'lucide-react'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, emptyStandardFilters, optionsFromRows } from '../lib/standardFilters'
import { normalizeStatus, statusDescription, statusTone } from '../lib/statusMatrix'
import Badge from '../components/ui/Badge'

const locationFields = [
  { key: 'location', label: 'Location', required: true, placeholder: 'RC-1031-RD-001-00-054' },
  { key: 'description', label: 'Description', required: true },
  { key: 'type', label: 'Type', options: ['Building', 'Floor', 'Room', 'Zone', 'External'] },
  { key: 'status', label: 'Status', options: ['OPERATING', 'PLANNED', 'DECOMMISSIONED'] },
  { key: 'priority', label: 'Priority', options: ['1', '2', '3'], placeholder: 'Select priority' },
  { key: 'priority  description', label: 'Priority Description', placeholder: 'VIP / Royal / Standard' },
  { key: 'site', label: 'Site', required: true, placeholder: '1031' },
  { key: 'builiding', label: 'Building', placeholder: 'Building code' },
  { key: 'builiding category', label: 'Building Category', placeholder: 'Building category' }
]

const emptyLocation = {
  location: '',
  description: '',
  type: 'Room',
  status: 'OPERATING',
  priority: '',
  'priority  description': '',
  site: '',
  builiding: '',
  'builiding category': ''
}
const templateHeaders = Object.keys(emptyLocation)
const normalizeLocationPriority = value => {
  const priority = Number(String(value || '').trim())
  return ['1', '2', '3'].includes(String(priority)) ? String(priority) : '3'
}

export default function LocationsPage({ initialLocations = [] }) {
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyLocation)
  const [locations, setLocations] = useState(initialLocations)
  const [filters, setFilters] = useState(emptyStandardFilters)
  const visibleLocations = applyStandardFilters(locations, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdDate']
  })

  const saveLocation = () => {
    setLocations(current => [{ ...form }, ...current])
    setForm(emptyLocation)
    setModalOpen(false)
  }

  return (
    <>
      <PageHeader
        eyebrow="PORTFOLIO"
        title="Locations"
        description="Manage the facility hierarchy across sites and buildings."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Locations_Template.xlsx" />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setLocations(rows.map(row => ({ ...row, status: normalizeStatus('location', row.status, 'OPERATING'), priority: normalizeLocationPriority(row.priority) })))} />
            <Button onClick={() => setModalOpen(true)}><Plus size={17} />Add location</Button>
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="location" onClear={() => setImported('')} />
      <IndexTabs active="All" tabs={[{ key: 'All', label: 'All Locations', count: locations.length }]} />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(locations, ['site'])}
        departmentOptions={optionsFromRows(locations, ['department'])}
        statusOptions={optionsFromRows(locations, ['status'])}
      />
      <section className="rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        {visibleLocations.length ? (
          <DataTable
            rows={visibleLocations}
            rowKey="location"
            pagination
            columns={[
              { key: 'location', label: 'Location', render: value => <strong className="mono">{value}</strong> },
              { key: 'description', label: 'Description' },
              { key: 'type', label: 'Type' },
              { key: 'status', label: 'Status', render: value => <Badge tone={statusTone(value)}>{value} · {statusDescription('location', value)}</Badge> },
              { key: 'priority', label: 'Priority' },
              { key: 'priority  description', label: 'Priority Description' },
              { key: 'site', label: 'Site' },
              { key: 'builiding', label: 'Building' },
              { key: 'builiding category', label: 'Building Category' },
              { key: 'open', label: '', render: () => <ChevronRight size={17} /> }
            ]}
          />
        ) : (
          <EmptyState
            icon={MapPin}
            title={locations.length ? 'No locations match the filters' : 'No locations added yet'}
            description={locations.length ? 'Reset the standard filters to view all location records.' : 'Create your first site, building, floor, room, or zone using the Add location button.'}
          />
        )}
      </section>

      {modalOpen && (
        <MasterRecordModal
          title="Add location"
          note="Create a location record for the facility hierarchy."
          fields={locationFields}
          form={form}
          setForm={setForm}
          onClose={() => setModalOpen(false)}
          onSave={() => {
            setLocations(current => [{ ...form, priority: normalizeLocationPriority(form.priority) }, ...current])
            setForm(emptyLocation)
            setModalOpen(false)
          }}
        />
      )}
    </>
  )
}
