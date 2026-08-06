import { useEffect, useState } from 'react'
import { Activity, Boxes, Building2, CalendarClock, Gauge, Hash, MapPin, Plus, Ruler, ShieldCheck, Users } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import ExcelImportButton from '../components/ui/ExcelImportButton'
import ExcelTemplateButton from '../components/ui/ExcelTemplateButton'
import ImportNotice from '../components/ui/ImportNotice'
import IndexTabs from '../components/ui/IndexTabs'
import MasterRecordModal from '../components/master-data/MasterRecordModal'
import MeterDetailPage from '../components/meters/MeterDetailPage'
import PageHeader from '../components/ui/PageHeader'
import TablePanel from '../components/ui/TablePanel'
import StandardFilters from '../components/ui/StandardFilters'
import { applyStandardFilters, optionsFromRows, scopedStandardFilters, useScopedFilters } from '../lib/standardFilters'
import { useAuth } from '../providers/AuthProvider'
import { nowLocalDate } from '../lib/datetime'
import { assetOptions, departmentOptions, locationOptions, siteOptions, withSuggestions } from '../lib/masterOptions'
import { mergeImportedRows } from '../lib/importRows'
import useModuleAccess from '../hooks/useModuleAccess'

const emptyMeter = {
  meterId: '',
  asset: '',
  location: '',
  site: '',
  department: '',
  meterType: 'General',
  reading: '',
  unit: '',
  readingDate: '',
  status: 'Active'
}

const templateHeaders = Object.keys(emptyMeter)
// Stamped when the form opens rather than when the module loads, so a session left open
// past midnight does not file readings under yesterday.
const blankMeter = () => ({ ...emptyMeter, readingDate: nowLocalDate() })
const meter = { section: 'Meter', sectionIcon: Gauge, sectionNote: 'Which meter this reading belongs to and what it measures', sectionSpan: 'full' }
const capture = { section: 'Reading', sectionIcon: Activity, sectionNote: 'The value recorded and when it was taken', sectionTone: 'green', sectionSpan: 'full' }

const fields = [
  { ...meter, key: 'meterId', label: 'Meter ID', icon: Hash, required: true, placeholder: 'Enter meter ID' },
  { ...meter, key: 'meterType', label: 'Meter Type', icon: Gauge, options: ['General', 'Water', 'Energy', 'Distance'] },
  { ...meter, key: 'asset', label: 'Asset', icon: Boxes, required: true },
  { ...meter, key: 'location', label: 'Location', icon: MapPin, required: true },
  { ...meter, key: 'site', label: 'Site', icon: Building2, required: true },
  { ...meter, key: 'department', label: 'Department', icon: Users, required: true },
  { ...capture, key: 'reading', label: 'Reading', icon: Activity, required: true, type: 'number' },
  { ...capture, key: 'unit', label: 'Unit', icon: Ruler, placeholder: 'kWh / m3 / km' },
  { ...capture, key: 'readingDate', label: 'Reading Date', icon: CalendarClock, type: 'date', required: true },
  { ...capture, key: 'status', label: 'Status', icon: ShieldCheck, options: ['Active', 'Inactive', 'Needs Review'] }
]

export default function MetersPage({ rows = [], setRows, assets = [], workOrders = [], siteRecords = [], departmentRecords = [], locationRows = [] }) {
  const modalFields = withSuggestions(fields, {
    asset: assetOptions(assets),
    location: locationOptions(locationRows),
    site: siteOptions(siteRecords),
    department: departmentOptions(departmentRecords)
  })
  const { user } = useAuth()
  const access = useModuleAccess('Meters')
  const [tab, setTab] = useState('All')
  const [filters, setFilters] = useScopedFilters(user, rows)
  const [imported, setImported] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(blankMeter)
  const routeId = decodeURIComponent(window.location.pathname.split('/meters/')[1] || '')
  const [selected, setSelected] = useState(rows.find(row => row.meterId === routeId) || null)
  useEffect(() => {
    if (!routeId) {
      setSelected(null)
      return
    }
    setSelected(rows.find(row => row.meterId === routeId) || null)
  }, [rows, routeId])

  const tabRows = tab === 'All' ? rows : rows.filter(row => row.status === tab)
  const visibleRows = applyStandardFilters(tabRows, filters, { date: ['readingDate'] })

  const save = () => {
    if (!form.meterId || !form.asset || !form.reading) return
    setRows?.(current => [{ ...form }, ...current])
    setForm(blankMeter())
    setModalOpen(false)
  }

  const open = row => {
    setSelected(row)
    window.history.pushState({}, '', `/meters/${row.meterId}`)
  }

  const close = () => {
    setSelected(null)
    window.history.pushState({}, '', '/meters')
  }

  const updateMeter = (meterId, patch) => {
    setRows?.(current => current.map(row => row.meterId === meterId ? { ...row, ...patch } : row))
    setSelected(current => current?.meterId === meterId ? { ...current, ...patch } : current)
  }

  const pastReadingsFor = meter => {
    const relatedRows = rows.filter(row => row.meterId === meter.meterId || (row.asset && row.asset === meter.asset))
    return [...relatedRows.map((row, index) => ({
      readingId: `${row.meterId}-${index}`,
      reading: row.reading,
      unit: row.unit,
      readingDate: row.readingDate,
      source: row.meterId === meter.meterId ? 'Current meter' : 'Same asset',
      workOrder: row.workOrder || '-',
      status: row.status || 'Posted'
    }))].sort((a, b) => String(b.readingDate).localeCompare(String(a.readingDate)))
  }

  if (selected) {
    return <MeterDetailPage meter={selected} pastReadings={pastReadingsFor(selected)} onBack={close} onUpdate={updateMeter} />
  }

  return (
    <>
      <PageHeader
        eyebrow="METER MANAGEMENT"
        title="Meters"
        description="Record and test asset readings for water, energy, runtime, and general meters."
        actions={(
          <div className="flex items-center gap-2">
            <ExcelTemplateButton headers={templateHeaders} fileName="Meters_Template.xlsx" />
            {access.import && <ExcelImportButton fileName={imported} onFile={setImported} onImport={rows => setRows(current => mergeImportedRows(current, rows, row => row.meterReadingId))} />}
            {access.create && <Button onClick={() => { setForm(blankMeter()); setModalOpen(true) }}><Plus size={17} />Add meter reading</Button>}
          </div>
        )}
      />

      <ImportNotice fileName={imported} subject="meter readings" onClear={() => setImported('')} />

      <IndexTabs
        active={tab}
        onChange={value => { setTab(value); setFilters(scopedStandardFilters(user, rows)) }}
        tabs={[
          { key: 'All', label: 'All Meters', count: rows.length },
          { key: 'Active', label: 'Active', count: rows.filter(row => row.status === 'Active').length },
          { key: 'Needs Review', label: 'Needs Review', count: rows.filter(row => row.status === 'Needs Review').length },
          { key: 'Inactive', label: 'Inactive', count: rows.filter(row => row.status === 'Inactive').length }
        ]}
      />

      <StandardFilters
        filters={filters}
        setFilters={setFilters}
        siteOptions={optionsFromRows(rows, ['site'])}
        departmentOptions={optionsFromRows(rows, ['department'])}
        statusOptions={optionsFromRows(rows, ['status'])}
      />

      <TablePanel>
        {visibleRows.length ? (
          <DataTable
            rows={visibleRows}
            rowKey="meterId"
            onRowClick={open}
            pagination
            columns={[
              { key: 'meterId', label: 'Meter ID', render: value => <strong className="mono">{value}</strong> },
              { key: 'asset', label: 'Asset' },
              { key: 'location', label: 'Location' },
              { key: 'site', label: 'Site' },
              { key: 'department', label: 'Department' },
              { key: 'meterType', label: 'Type' },
              { key: 'reading', label: 'Reading', render: (value, row) => <strong>{value} {row.unit}</strong> },
              { key: 'readingDate', label: 'Reading Date' },
              { key: 'status', label: 'Status', render: value => <Badge tone={value === 'Active' ? 'green' : 'orange'}>{value}</Badge> }
            ]}
          />
        ) : (
          <EmptyState icon={Gauge} title="No meter readings found" description="Add a reading or reset the standard filters to continue testing the Meters module." />
        )}
      </TablePanel>

      {modalOpen && (
        <MasterRecordModal
          title="Add meter reading"
          note="Create a standalone meter reading record for testing and reporting."
          fields={modalFields}
          form={form}
          setForm={setForm}
          onClose={() => setModalOpen(false)}
          onSave={save}
          submitLabel="Create reading"
        />
      )}
    </>
  )
}


