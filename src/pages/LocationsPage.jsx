import { useState } from 'react'
import { ChevronRight, MapPin, Plus } from 'lucide-react'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'

const locationFields = [
  { key: 'site', label: 'Site', required: true, placeholder: '1031' },
  { key: 'location', label: 'Location', required: true, placeholder: 'RC-1031-RD-001-00-054' },
  { key: 'description', label: 'Description', required: true, full: true },
  { key: 'type', label: 'Type', options: ['Building', 'Floor', 'Room', 'Zone', 'External'] },
  { key: 'parent', label: 'Parent Location', placeholder: 'Optional hierarchy parent' },
  { key: 'department', label: 'Department', placeholder: 'Responsible department' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }
]

export default function LocationsPage() {
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ site: '', location: '', description: '', type: 'Room', parent: '', department: '', status: 'Active' })
  const [locations, setLocations] = useState([])

  const saveLocation = () => {
    setLocations(current => [{ ...form }, ...current])
    setForm({ site: '', location: '', description: '', type: 'Room', parent: '', department: '', status: 'Active' })
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
            <ExcelImportButton fileName={imported} onFile={setImported} />
            <Button onClick={() => setModalOpen(true)}><Plus size={17} />Add location</Button>
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="location" onClear={() => setImported('')} />
      <IndexTabs active="All" tabs={[{ key: 'All', label: 'All Locations', count: locations.length }]} />
      <section className="rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        {locations.length ? (
          <DataTable
            rows={locations}
            rowKey="location"
            pagination
            columns={[
              { key: 'location', label: 'Location', render: value => <strong className="mono">{value}</strong> },
              { key: 'description', label: 'Description' },
              { key: 'site', label: 'Site' },
              { key: 'type', label: 'Type' },
              { key: 'parent', label: 'Parent' },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status' },
              { key: 'open', label: '', render: () => <ChevronRight size={17} /> }
            ]}
          />
        ) : (
          <EmptyState
            icon={MapPin}
            title="No location records yet"
            description="The Excel location file contains its field structure but no rows. Add locations when the source is ready."
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
          onSave={saveLocation}
        />
      )}
    </>
  )
}
