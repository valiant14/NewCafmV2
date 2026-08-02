import { useState } from 'react'
import { ChevronRight, MapPin, Plus } from 'lucide-react'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import LocationDetailPage from '../components/locations/LocationDetailPage'
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
const normalizeLocationRow = row => ({
  location: row.location || row['location '] || '',
  description: row.description || row['description '] || '',
  type: row.type || 'Room',
  status: normalizeStatus('location', row.status || row['status '], 'OPERATING'),
  priority: normalizeLocationPriority(row.priority),
  'priority  description': row['priority  description'] || '',
  site: String(row.site || ''),
  builiding: row.builiding || row.building || '',
  'builiding category': row['builiding category'] || row['building category'] || '',
  department: row.department || ''
})

export default function LocationsPage({ rows = [], setRows, assets = [], workOrders = [], onUpdateLocation }) {
  const seededLocations = rows.map(normalizeLocationRow)
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyLocation)
  const routeId = decodeURIComponent(window.location.pathname.split('/locations/')[1] || '')
  const [selected, setSelected] = useState(seededLocations.find(row => row.location === routeId) || null)
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(emptyStandardFilters)
  const tabLocations = tab === 'All' ? seededLocations : seededLocations.filter(location => location.status === tab)
  const visibleLocations = applyStandardFilters(tabLocations, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdDate']
  })

  const saveLocation = () => {
    setRows?.(current => [{ ...form }, ...current])
    setForm(emptyLocation)
    setModalOpen(false)
  }

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/locations/${encodeURIComponent(row.location)}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/locations')
  }

  const updateLocation = (locationId, patch) => {
    if (onUpdateLocation) onUpdateLocation(locationId, patch)
    else setRows?.(current => current.map(row => row.location === locationId ? { ...row, ...patch } : row))
    setSelected(current => current?.location === locationId ? { ...current, ...patch } : current)
  }

  const relatedAssets = location => assets
    .filter(asset => asset.location === location.location || String(asset.location || '').startsWith(location.location))
    .map(asset => ({
      assetnum: asset.assetnum,
      description: asset.description,
      department: asset.department,
      status: asset.status,
      site: asset.site
    }))

  const relatedWorkOrders = location => workOrders
    .filter(order => String(order['LOCATION '] || '').startsWith(location.location))
    .map(order => ({
      workOrder: order.WORKORDER,
      description: order['DESCRIPITION '] || order.DESCRIPTION || 'Work order',
      workType: String(order['WORK TYPE '] || order['WORK TYPE  '] || '').trim(),
      status: order.STATUS,
      department: order['DEPARTMENT '],
      site: order.SITE
    }))

  if (selected) {
    return (
      <LocationDetailPage
        location={selected}
        assets={relatedAssets(selected)}
        workOrders={relatedWorkOrders(selected)}
        onBack={close}
        onUpdate={updateLocation}
      />
    )
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
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setRows?.(rows.map(normalizeLocationRow))} />
            <Button onClick={() => setModalOpen(true)}><Plus size={17} />Add location</Button>
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="location" onClear={() => setImported('')} />
      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(emptyStandardFilters) }}
        tabs={[
          { key: 'All', label: 'All Locations', count: seededLocations.length },
          { key: 'OPERATING', label: 'Operating', count: seededLocations.filter(location => location.status === 'OPERATING').length },
          { key: 'PLANNED', label: 'Planned', count: seededLocations.filter(location => location.status === 'PLANNED').length },
          { key: 'DECOMMISSIONED', label: 'Decommissioned', count: seededLocations.filter(location => location.status === 'DECOMMISSIONED').length }
        ]}
      />
      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(seededLocations, ['site'])}
        departmentOptions={optionsFromRows(seededLocations, ['department'])}
        statusOptions={optionsFromRows(seededLocations, ['status'])}
      />
      <section className="rounded-2xl border border-[var(--app-line)] bg-white shadow-[0_8px_24px_rgba(32,55,45,.06)]">
        {visibleLocations.length ? (
          <DataTable
            rows={visibleLocations}
            rowKey="location"
            onRowClick={open}
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
            title={seededLocations.length ? 'No locations match the filters' : 'No locations added yet'}
            description={seededLocations.length ? 'Reset the standard filters to view all location records.' : 'Create your first site, building, floor, room, or zone using the Add location button.'}
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
            setRows?.(current => [{ ...form, priority: normalizeLocationPriority(form.priority) }, ...current])
            setForm(emptyLocation)
            setModalOpen(false)
          }}
        />
      )}
    </>
  )
}
