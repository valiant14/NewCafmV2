import { useState } from 'react'
import { ChevronRight, MapPin, Plus } from 'lucide-react'
import locationSeed from '../data/locations.json'
import { assets, workOrders } from '../data/cafmData'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ExportExcelButton from '../components/ui/ExportExcelButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import LocationDetailPage from '../components/locations/LocationDetailPage'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import PageHeader from '../components/ui/PageHeader'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, optionsFromRows, scopedStandardFilters } from '../lib/standardFilters'
import { normalizeStatus, statusDescription, statusTone } from '../lib/statusMatrix'
import { conformsToLocationCode, nextLocationCode, validateLocationCode } from '../lib/coding'
import { useAuth } from '../providers/AuthProvider'
import Badge from '../components/ui/Badge'

const locationFields = [
  { key: 'location', label: 'Location', required: true, placeholder: 'Fill site and building to generate' },
  { key: 'floorCode', label: 'Floor (for the code)', placeholder: '00' },
  { key: 'roomCode', label: 'Room / Zone (for the code)', placeholder: '054' },
  { key: 'description', label: 'Description', required: true },
  { key: 'type', label: 'Type', options: ['Building', 'Floor', 'Room', 'Zone', 'Store', 'External'] },
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

const exportColumns = [
  { key: 'location', label: 'Location Code' },
  { key: 'description', label: 'Description' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'priority  description', label: 'Priority Description' },
  { key: 'site', label: 'Site' },
  { key: 'builiding', label: 'Building' },
  { key: 'builiding category', label: 'Building Category' },
  { key: 'department', label: 'Department' }
]
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

export default function LocationsPage({ initialLocations = [] }) {
  const { user } = useAuth()
  const seededLocations = (initialLocations?.length ? initialLocations : locationSeed).map(normalizeLocationRow)
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [form, setForm] = useState(emptyLocation)
  const [locations, setLocations] = useState(seededLocations)
  const routeId = decodeURIComponent(window.location.pathname.split('/locations/')[1] || '')
  const [selected, setSelected] = useState(seededLocations.find(row => row.location === routeId) || null)
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useState(() => scopedStandardFilters(user, seededLocations, ['site']))
  const tabLocations = tab === 'All' ? locations : locations.filter(location => location.status === tab)
  const visibleLocations = applyStandardFilters(tabLocations, filters, {
    site: ['site'],
    department: ['department'],
    status: ['status'],
    date: ['createdDate']
  })

  // Previously this saved whatever was in the form, with no validation at all.
  const saveLocation = () => {
    const missing = [!form.description && 'Description', !form.site && 'Site'].filter(Boolean)
    if (missing.length) return setCodeError(`Complete ${missing.join(', ')} before saving.`)
    const check = validateLocationCode(form.location, { rows: locations, site: form.site, building: form.builiding })
    if (!check.valid) return setCodeError(check.reason)
    const { floorCode, roomCode, ...record } = form
    setLocations(current => [{ ...record }, ...current])
    setForm(emptyLocation)
    setCodeError('')
    setModalOpen(false)
  }
  const updateLocationForm = update => setForm(current => {
    const next = typeof update === 'function' ? update(current) : update
    const partsChanged = ['site', 'builiding', 'floorCode', 'roomCode'].some(key => next[key] !== current[key])
    if (!partsChanged) return next
    const generated = nextLocationCode({ site: next.site, building: next.builiding, floor: next.floorCode, room: next.roomCode })
    const previous = nextLocationCode({ site: current.site, building: current.builiding, floor: current.floorCode, room: current.roomCode })
    // Never overwrite a code the user typed themselves.
    return !next.location || next.location === previous ? { ...next, location: generated || next.location } : next
  })

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/locations/${encodeURIComponent(row.location)}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/locations')
  }

  const updateLocation = (locationId, patch) => {
    setLocations(current => current.map(row => row.location === locationId ? { ...row, ...patch } : row))
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
            <ExportExcelButton module="Locations" rows={visibleLocations} columns={exportColumns} />
            <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setLocations(rows.map(normalizeLocationRow))} />
            <Button onClick={() => setModalOpen(true)}><Plus size={17} />Add location</Button>
          </div>
        )}
      />
      <ImportNotice fileName={imported} subject="location" onClear={() => setImported('')} />
      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(scopedStandardFilters(user, seededLocations, ['site'])) }}
        tabs={[
          { key: 'All', label: 'All Locations', count: locations.length },
          { key: 'OPERATING', label: 'Operating', count: locations.filter(location => location.status === 'OPERATING').length },
          { key: 'PLANNED', label: 'Planned', count: locations.filter(location => location.status === 'PLANNED').length },
          { key: 'DECOMMISSIONED', label: 'Decommissioned', count: locations.filter(location => location.status === 'DECOMMISSIONED').length }
        ]}
      />
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
            onRowClick={open}
            pagination
            columns={[
              { key: 'location', label: 'Location', render: value => (
                <span className="flex items-center gap-2">
                  <strong className="mono">{value}</strong>
                  {value && !conformsToLocationCode(value) && <Badge tone="orange">Code</Badge>}
                </span>
              ) },
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
          error={codeError}
          form={form}
          setForm={updateLocationForm}
          onClose={() => { setModalOpen(false); setCodeError('') }}
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
